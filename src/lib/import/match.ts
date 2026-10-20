import type { Exercise, MovementPattern, MuscleGroup } from "@/lib/domain/types";

/**
 * Resolving imported exercise names to the library.
 *
 * 1. Exact: the name means the same as a library name or alias once
 *    normalized ("Bench Press - Barbell" = "Bench Press (Barbell)"). Code
 *    decides these; they're certain and need no review.
 * 2. Similar: a spelling-level guess with a score. Capped below the
 *    auto-confirm threshold, so the user always checks these.
 * 3. AI: names that need knowledge ("Military Press" is an overhead press)
 *    go to the model, which returns a match or a new exercise with reasons.
 */

export type MatchMethod = "exact" | "similar" | "ai" | "none";

export type NewExerciseDraft = {
  name: string;
  pattern: MovementPattern;
  muscles: MuscleGroup[];
};

export type Suggestion = {
  name: string;
  /** Library exercise this name should map to, or null for a new exercise. */
  exerciseId: string | null;
  /** 0–1. Exact matches are 1. */
  confidence: number;
  method: MatchMethod;
  reason?: string;
  /** When exerciseId is null: what the new exercise should look like. */
  newExercise?: NewExerciseDraft;
};

/** Suggestions at or above this are confirmed automatically on import. */
export const AUTO_CONFIRM = 0.9;
/** Spelling guesses never reach auto-confirm: someone should look. */
const SIMILAR_CAP = 0.89;
const SIMILAR_MIN = 0.5;

const ABBREVIATIONS: Record<string, string[]> = {
  bb: ["barbell"],
  db: ["dumbbell"],
  dbs: ["dumbbell"],
  kb: ["kettlebell"],
  ohp: ["overhead", "press"],
  dl: ["deadlift"],
  rdl: ["romanian", "deadlift"],
  cgbp: ["close", "grip", "bench", "press"],
};
const STOPWORDS = new Set(["the", "a", "an", "with", "of", "and", "on", "machine"]);

/** Lowercase tokens with abbreviations expanded, compounds joined and simple plurals removed. */
export function tokenize(name: string): string[] {
  const raw = name
    .toLowerCase()
    .replace(/[()[\]\-_/.,:+&]/g, " ")
    // "pull down" / "pull-up" / "push ups" → "pulldown" / "pullup" / "pushups"
    .replace(/\b(pull|push|chin|sit)\s+(up|down)(s?)\b/g, "$1$2$3")
    .split(/\s+/)
    .filter(Boolean);
  const tokens: string[] = [];
  for (const t of raw) {
    for (const word of ABBREVIATIONS[t] ?? [t]) {
      if (STOPWORDS.has(word)) continue;
      tokens.push(word.length > 3 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word);
    }
  }
  return tokens;
}

/** Order-independent key: names with the same key mean the same thing. */
export function nameKey(name: string) {
  return [...new Set(tokenize(name))].sort().join(" ");
}

function bigrams(s: string) {
  const grams = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) {
    const g = s.slice(i, i + 2);
    grams.set(g, (grams.get(g) ?? 0) + 1);
  }
  return grams;
}

function dice(a: string, b: string) {
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  const ga = bigrams(a);
  const gb = bigrams(b);
  let overlap = 0;
  for (const [g, n] of ga) overlap += Math.min(n, gb.get(g) ?? 0);
  return (2 * overlap) / (a.length - 1 + (b.length - 1));
}

/**
 * How alike an imported name is to a candidate, 0–1. Mixes word overlap,
 * how much of the imported name the candidate explains (so "Incline DB
 * Bench" prefers "Incline Bench Press (Dumbbell)" over "DB Bench"), and
 * character similarity for near-spellings.
 */
export function similarity(input: string, candidate: string) {
  const sa = new Set(tokenize(input));
  const sb = new Set(tokenize(candidate));
  if (!sa.size || !sb.size) return 0;
  let shared = 0;
  for (const t of sa) if (sb.has(t)) shared++;
  const jaccard = shared / (sa.size + sb.size - shared);
  const coverage = shared / sa.size;
  const chars = dice([...sa].sort().join(" "), [...sb].sort().join(" "));
  return 0.4 * jaccard + 0.35 * coverage + 0.25 * chars;
}

export function matchName(name: string, library: Exercise[]): Suggestion {
  const key = nameKey(name);
  const compact = tokenize(name).join("");
  let best: { exercise: Exercise; score: number; via: string } | null = null;

  for (const exercise of library) {
    for (const candidate of [exercise.name, ...exercise.aliases]) {
      if (nameKey(candidate) === key || tokenize(candidate).join("") === compact) {
        return { name, exerciseId: exercise.id, confidence: 1, method: "exact", reason: `Same as “${candidate}”` };
      }
      const score = similarity(name, candidate);
      if (!best || score > best.score) best = { exercise, score, via: candidate };
    }
  }

  if (best && best.score >= SIMILAR_MIN) {
    return {
      name,
      exerciseId: best.exercise.id,
      confidence: Math.min(Math.round(best.score * 100) / 100, SIMILAR_CAP),
      method: "similar",
      reason: `Spelled like “${best.via}”`,
    };
  }
  return { name, exerciseId: null, confidence: 0, method: "none" };
}

export function matchNames(names: string[], library: Exercise[]) {
  return names.map((n) => matchName(n, library));
}

/** Names that should go to the AI: anything code couldn't settle with certainty. */
export function needsAi(suggestions: Suggestion[]) {
  return suggestions.filter((s) => s.method !== "exact").map((s) => s.name);
}

/** Merge AI results over code suggestions. Exact matches are never overridden. */
export function mergeAi(suggestions: Suggestion[], ai: Suggestion[], library: Map<string, Exercise>) {
  const byName = new Map(ai.map((s) => [s.name, s]));
  return suggestions.map((s) => {
    const fromAi = byName.get(s.name);
    if (s.method === "exact" || !fromAi) return s;
    if (fromAi.exerciseId && !library.has(fromAi.exerciseId)) return s; // unknown id: ignore
    return { ...fromAi, method: "ai" as const };
  });
}
