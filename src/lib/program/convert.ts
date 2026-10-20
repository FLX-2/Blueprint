import type { Exercise, ExerciseSlot, Program, Rule, SetScheme, SourceSpan, Tier } from "@/lib/domain/types";
import { AUTO_CONFIRM, matchName, type Suggestion } from "@/lib/import/match";
import type { ExtractedProgram, ExtractedRule } from "./extract-schema";

/**
 * Turns the model's reading of a program into a draft the lifter reviews.
 * The model proposes; this code checks: it finds each quote in the source,
 * validates every rule's parameters, matches exercise names to the library,
 * and decides what needs a human look before anything can run.
 */

export type DraftSlot = {
  id: string;
  /** As written in the program. */
  name: string;
  alternatives: string[];
  match: Suggestion;
  /** Library exercise, a custom one, or null until the lifter picks. */
  exerciseId: string | null;
  tier: Tier;
  scheme: SetScheme;
  confidence: number;
  span: SourceSpan | null;
  confirmed: boolean;
};

export type DraftRule = {
  id: string;
  tier: Tier;
  /** null when the extracted parameters don't add up to a runnable rule. */
  rule: Rule | null;
  issues: string[];
  reason: string;
  confidence: number;
  span: SourceSpan | null;
  confirmed: boolean;
};

export type ProgramDraft = {
  name: string;
  sourceText: string;
  days: Array<{ id: string; name: string; slots: DraftSlot[] }>;
  rules: DraftRule[];
  notes: string[];
};

/**
 * Where a quote sits in the source. Tries an exact match, then one that
 * ignores case, whitespace and typographic quotes.
 */
export function locate(source: string, quote: string): SourceSpan | null {
  const q = quote.trim();
  if (!q) return null;
  const exact = source.indexOf(q);
  if (exact !== -1) return { start: exact, end: exact + q.length };

  const norm = (c: string) => c.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
  // Build a normalized copy of the source with a map back to original offsets.
  let normalized = "";
  const map: number[] = [];
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (/\s/.test(c)) {
      if (normalized.endsWith(" ")) continue;
      normalized += " ";
    } else {
      normalized += norm(c);
    }
    map.push(i);
  }
  const needle = q.split(/\s+/).map((w) => [...w].map(norm).join("")).join(" ");
  const at = normalized.indexOf(needle);
  if (at === -1) return null;
  return { start: map[at], end: map[at + needle.length - 1] + 1 };
}

/** Percentages sometimes come back as 85 rather than 0.85. */
const fraction = (n: number) => (n > 1.5 ? n / 100 : n);
const positive = (n: number | null): n is number => n !== null && Number.isFinite(n) && n > 0;
const scheme = (s: { sets: number; reps: number; amrap_last: boolean }): SetScheme => ({ sets: s.sets, reps: s.reps, amrapLast: s.amrap_last });

/** Checks a rule's parameters and builds the domain rule, or explains what's missing. */
export function toRule(raw: ExtractedRule, id: string): { rule: Rule | null; issues: string[] } {
  const base = { id, tier: raw.tier, status: "proposed" as const, confidence: raw.confidence };
  const issues: string[] = [];
  const increment = () => {
    if (!positive(raw.increment_upper) || !positive(raw.increment_lower)) {
      issues.push("The weight jump isn’t clear.");
      return null;
    }
    return { upper: raw.increment_upper, lower: raw.increment_lower };
  };

  switch (raw.kind) {
    case "linear": {
      const inc = increment();
      return { rule: inc ? { ...base, kind: "linear", increment: inc } : null, issues };
    }
    case "amrap-threshold": {
      const inc = increment();
      if (!positive(raw.rep_target)) issues.push("The rep target for the last set isn’t clear.");
      return { rule: inc && positive(raw.rep_target) ? { ...base, kind: "amrap-threshold", repTarget: raw.rep_target, increment: inc } : null, issues };
    }
    case "double-progression": {
      const inc = increment();
      const ok = positive(raw.rep_min) && positive(raw.rep_max) && raw.rep_min < raw.rep_max;
      if (!ok) issues.push("The rep range isn’t clear.");
      return {
        rule: inc && ok ? { ...base, kind: "double-progression", repRange: { min: raw.rep_min!, max: raw.rep_max! }, increment: inc } : null,
        issues,
      };
    }
    case "stage-on-failure": {
      const stages = (raw.stages ?? []).filter((s) => s.sets > 0 && s.reps > 0).map(scheme);
      if (stages.length < 2) issues.push("Needs at least two stages to step through.");
      if (!raw.reset) issues.push("What happens after the last stage isn’t clear.");
      const percent = raw.reset ? fraction(raw.reset.percent) : 0;
      if (raw.reset && !(percent > 0 && percent <= 1)) issues.push("The reset percentage isn’t clear.");
      return {
        rule:
          issues.length || !raw.reset
            ? null
            : {
                ...base,
                kind: "stage-on-failure",
                stages,
                reset: { to: scheme(raw.reset), percentOf: raw.reset.percent_of, percent },
              },
        issues,
      };
    }
    case "percentage-cycle": {
      const inc = increment();
      const weeks = (raw.cycle_weeks ?? []).map((w) => ({ sets: w.sets.map((s) => ({ percent: fraction(s.percent), reps: s.reps, amrap: s.amrap })) }));
      if (!weeks.length || weeks.some((w) => !w.sets.length)) issues.push("The weekly percentages aren’t clear.");
      return { rule: inc && !issues.length ? { ...base, kind: "percentage-cycle", weeks, increment: inc } : null, issues };
    }
    case "unsupported":
      return { rule: null, issues: ["Blueprint can’t run this kind of progression yet. Slots in this tier will keep their weight."] };
  }
}

export function draftFrom(extracted: ExtractedProgram, sourceText: string, library: Exercise[]): ProgramDraft {
  let n = 0;
  const days = extracted.days.map((day, di) => ({
    id: `d${di + 1}`,
    name: day.name,
    slots: day.slots.map((s): DraftSlot => {
      const match = matchName(s.exercise, library);
      const span = locate(sourceText, s.source_quote);
      const certain = (match.method === "exact" || match.confidence >= AUTO_CONFIRM) && s.alternatives.length === 0;
      return {
        id: `s${++n}`,
        name: s.exercise,
        alternatives: s.alternatives,
        match,
        exerciseId: s.alternatives.length ? null : match.exerciseId,
        tier: s.tier,
        scheme: scheme(s),
        confidence: s.confidence,
        span,
        confirmed: certain && s.confidence >= AUTO_CONFIRM,
      };
    }),
  }));

  const rules = extracted.rules.map((raw, i): DraftRule => {
    const id = `rule-${i + 1}`;
    const { rule, issues } = toRule(raw, id);
    const span = locate(sourceText, raw.source_quote);
    return {
      id,
      tier: raw.tier,
      rule,
      issues,
      reason: raw.reason,
      confidence: raw.confidence,
      span,
      confirmed: !!rule && !issues.length && raw.confidence >= AUTO_CONFIRM && !!span,
    };
  });

  return { name: extracted.name, sourceText, days, rules, notes: extracted.notes };
}

/** Things to resolve before approval, plus non-blocking warnings. */
export function draftIssues(draft: ProgramDraft) {
  const blocking: Array<{ kind: "slot" | "rule"; id: string; label: string }> = [];
  for (const day of draft.days) {
    for (const slot of day.slots) {
      if (!slot.confirmed || !slot.exerciseId) blocking.push({ kind: "slot", id: slot.id, label: `${day.name} · ${slot.name}` });
    }
  }
  for (const r of draft.rules) {
    // Rules that can't run never block: they're left out, with a warning.
    if (r.rule && !r.confirmed) blocking.push({ kind: "rule", id: r.id, label: `${r.tier} · ${r.rule.kind.replace(/-/g, " ")}` });
  }

  const warnings: string[] = [];
  const tiers = new Set(draft.days.flatMap((d) => d.slots.map((s) => s.tier)));
  for (const tier of tiers) {
    const runnable = draft.rules.filter((r) => r.tier === tier && r.rule);
    if (!runnable.some((r) => r.rule!.kind !== "stage-on-failure")) {
      warnings.push(`${tier} has no progression rule Blueprint can run, so its weights won’t go up on their own.`);
    }
  }
  for (const r of draft.rules) if (!r.rule) warnings.push(`${r.tier}: ${r.issues.join(" ")} This rule is left out.`);
  return { blocking, warnings };
}

/** The runnable program, from a fully reviewed draft. */
export function programFrom(draft: ProgramDraft, id: string): Program {
  return {
    id,
    name: draft.name,
    source: { kind: "text", label: "Pasted text" },
    days: draft.days.map((d) => ({
      id: d.id,
      name: d.name,
      slots: d.slots.map((s): ExerciseSlot => ({ exerciseId: s.exerciseId!, tier: s.tier, scheme: s.scheme })),
    })),
    rules: draft.rules.flatMap((r) => (r.rule && r.confirmed ? [{ ...r.rule, status: "confirmed" as const, source: r.span ?? undefined }] : [])),
  };
}
