import { epley, roundToLoadable } from "@/lib/calc/strength";
import { formatScheme } from "@/lib/domain/describe";
import type {
  Athlete,
  Exercise,
  ExerciseSlot,
  IsoDate,
  Program,
  ProgramDay,
  Rule,
  Session,
  SetLog,
  SetScheme,
  Tier,
} from "@/lib/domain/types";

/**
 * The rule engine: given a program, the lifter's state, and what they did,
 * decides what they do next. Pure and deterministic. The AI reads rules out
 * of a program; this code is what runs them.
 *
 * State is kept per slot (tier + exercise), so a lift trained as T1 and T2
 * progresses separately in each, as most tiered programs intend.
 */

export type SlotKey = `${Tier}:${string}`;

export type SlotState = {
  weight: number;
  /** Index into the tier's stage-on-failure stages (0 = the slot's own scheme). */
  stage: number;
  /** Current rep target, for double progression. */
  reps?: number;
  /** Current week (0-based), for percentage cycles. */
  cycleWeek?: number;
  /** For percentage cycles: the weight percentages apply to. */
  trainingMax?: number;
};

export type ProgramState = Record<SlotKey, SlotState>;

export type PrescribedSet = { weight: number; reps: number; amrap: boolean };

export type Prescription = {
  key: SlotKey;
  slot: ExerciseSlot;
  /** null when there's no state yet (the lifter needs to set a starting weight). */
  sets: PrescribedSet[] | null;
  /** Display scheme, e.g. "6×2+". */
  scheme: string;
  note?: string;
};

export type EventKind = "progressed" | "held" | "stage-down" | "reset" | "skipped" | "cycle";

export type RuleEvent = {
  key: SlotKey;
  kind: EventKind;
  /** Plain language, shown in the session summary. */
  message: string;
  from: SlotState;
  to: SlotState;
  ruleId?: string;
  /** The program asked for a retest (e.g. a new 5RM) before continuing. */
  needsRetest?: boolean;
};

export const slotKey = (slot: Pick<ExerciseSlot, "tier" | "exerciseId">): SlotKey => `${slot.tier}:${slot.exerciseId}`;

const PROGRESSION_KINDS = new Set<Rule["kind"]>(["linear", "amrap-threshold", "double-progression", "percentage-cycle"]);

/** Confirmed rules for a tier: one progression rule and an optional failure rule. Proposed rules never run. */
export function rulesFor(program: Program, tier: Tier) {
  const confirmed = program.rules.filter((r) => r.tier === tier && r.status === "confirmed");
  return {
    progression: confirmed.find((r) => PROGRESSION_KINDS.has(r.kind)),
    failure: confirmed.find((r): r is Extract<Rule, { kind: "stage-on-failure" }> => r.kind === "stage-on-failure"),
  };
}

function incrementFor(rule: { increment: { upper: number; lower: number } }, exercise: Exercise) {
  return exercise.body === "lower" ? rule.increment.lower : rule.increment.upper;
}

/** The scheme a slot runs right now, after any failure stages. */
export function currentScheme(program: Program, slot: ExerciseSlot, state: SlotState | undefined): SetScheme {
  const { progression, failure } = rulesFor(program, slot.tier);
  const base = failure && state ? (failure.stages[state.stage] ?? slot.scheme) : slot.scheme;
  if (progression?.kind === "double-progression") return { ...base, reps: state?.reps ?? progression.repRange.min };
  return base;
}

export function prescribe(program: Program, day: ProgramDay, state: ProgramState, athlete: Athlete): Prescription[] {
  return day.slots.map((slot) => {
    const key = slotKey(slot);
    const s = state[key];
    const { progression } = rulesFor(program, slot.tier);

    if (progression?.kind === "percentage-cycle") {
      const week = progression.weeks[(s?.cycleWeek ?? 0) % progression.weeks.length];
      const tm = s?.trainingMax;
      return {
        key,
        slot,
        sets: tm ? week.sets.map((w) => ({ weight: roundToLoadable(tm * w.percent, athlete.smallestPlatePair), reps: w.reps, amrap: w.amrap })) : null,
        scheme: week.sets.map((w) => `${w.reps}${w.amrap ? "+" : ""}`).join("/"),
        note: `Week ${(s?.cycleWeek ?? 0) + 1} of ${progression.weeks.length}`,
      };
    }

    const scheme = currentScheme(program, slot, s);
    return {
      key,
      slot,
      sets: s
        ? Array.from({ length: scheme.sets }, (_, i) => ({ weight: s.weight, reps: scheme.reps, amrap: scheme.amrapLast && i === scheme.sets - 1 }))
        : null,
      scheme: formatScheme(scheme),
      note: s && s.stage > 0 ? `Stage ${s.stage + 1} after a missed session` : undefined,
    };
  });
}

/** Hit every prescribed set's reps (AMRAP sets count as hit at the target). */
function succeeded(prescribed: PrescribedSet[], performed: SetLog[]) {
  if (performed.length < prescribed.length) return false;
  return prescribed.every((p, i) => performed[i].reps >= p.reps);
}

/** Applies one slot's performed sets and returns its next state and what happened. */
export function applySlot(opts: {
  program: Program;
  slot: ExerciseSlot;
  exercise: Exercise;
  state: SlotState;
  performed: SetLog[];
  athlete: Athlete;
}): { state: SlotState; event: RuleEvent } {
  const { program, slot, exercise, state, performed, athlete } = opts;
  const key = slotKey(slot);
  const { progression, failure } = rulesFor(program, slot.tier);
  const round = (w: number) => roundToLoadable(w, athlete.smallestPlatePair);
  const event = (kind: EventKind, to: SlotState, message: string, extra: Partial<RuleEvent> = {}) => ({
    state: to,
    event: { key, kind, message, from: state, to, ...extra },
  });

  if (!performed.length) return event("skipped", state, `${exercise.name} wasn’t logged, so nothing changes.`);

  if (progression?.kind === "percentage-cycle") {
    const weeks = progression.weeks.length;
    const nextWeek = (state.cycleWeek ?? 0) + 1;
    if (nextWeek < weeks) {
      return event("progressed", { ...state, cycleWeek: nextWeek }, `On to week ${nextWeek + 1} of ${weeks}.`, { ruleId: progression.id });
    }
    const tm = (state.trainingMax ?? 0) + incrementFor(progression, exercise);
    return event("cycle", { ...state, cycleWeek: 0, trainingMax: tm }, `Cycle done: training max goes up to ${tm} lb.`, { ruleId: progression.id });
  }

  const scheme = currentScheme(program, slot, state);
  const prescribed = Array.from({ length: scheme.sets }, () => ({ weight: state.weight, reps: scheme.reps, amrap: false }));
  const hit = succeeded(prescribed, performed);
  const last = performed.at(-1)!;

  if (hit && progression) {
    switch (progression.kind) {
      case "linear": {
        const weight = state.weight + incrementFor(progression, exercise);
        return event("progressed", { ...state, weight }, `All reps hit: ${weight} lb next time.`, { ruleId: progression.id });
      }
      case "amrap-threshold": {
        if (last.reps >= progression.repTarget) {
          const weight = state.weight + incrementFor(progression, exercise);
          return event("progressed", { ...state, weight }, `Last set hit ${last.reps} (target ${progression.repTarget}+): ${weight} lb next time.`, { ruleId: progression.id });
        }
        return event("held", state, `Last set hit ${last.reps} of ${progression.repTarget}: same weight next time.`, { ruleId: progression.id });
      }
      case "double-progression": {
        const reps = state.reps ?? progression.repRange.min;
        if (reps < progression.repRange.max) {
          return event("progressed", { ...state, reps: reps + 1 }, `All reps hit: ${scheme.sets}×${reps + 1} at ${state.weight} lb next time.`, { ruleId: progression.id });
        }
        const weight = state.weight + incrementFor(progression, exercise);
        return event(
          "progressed",
          { ...state, weight, reps: progression.repRange.min },
          `Top of the range: ${weight} lb for ${scheme.sets}×${progression.repRange.min} next time.`,
          { ruleId: progression.id },
        );
      }
    }
  }

  if (hit) return event("held", state, "All reps hit. No progression rule is confirmed for this tier, so the weight stays.");

  if (!failure) return event("held", state, `Missed reps: same weight next time.`, { ruleId: progression?.id });

  if (state.stage < failure.stages.length - 1) {
    const stage = state.stage + 1;
    return event("stage-down", { ...state, stage }, `Missed reps: switch to ${formatScheme(failure.stages[stage])} at ${state.weight} lb.`, { ruleId: failure.id });
  }

  // Failed the last stage: reset lighter.
  const percent = Math.round(failure.reset.percent * 100);
  if (failure.reset.percentOf === "last-weight") {
    const weight = round(state.weight * failure.reset.percent);
    return event("reset", { ...state, stage: 0, weight }, `Missed the last stage: restart ${formatScheme(failure.reset.to)} at ${weight} lb (${percent}%).`, { ruleId: failure.id });
  }
  // Retest a 5RM. Until the lifter does, estimate it from today's best set.
  const best = Math.max(...performed.map((s) => epley(s.weight, s.reps)));
  const estimated5rm = best / (1 + 5 / 30);
  const weight = round(estimated5rm * failure.reset.percent);
  return event(
    "reset",
    { ...state, stage: 0, weight },
    `Missed the last stage: retest your 5RM. Until then, restart ${formatScheme(failure.reset.to)} at ${weight} lb (${percent}% of an estimated ${Math.round(estimated5rm)} lb).`,
    { ruleId: failure.id, needsRetest: true },
  );
}

/** Applies a whole logged session to every slot of its program day. */
export function applySession(opts: {
  program: Program;
  day: ProgramDay;
  state: ProgramState;
  sets: SetLog[];
  exercises: Map<string, Exercise>;
  athlete: Athlete;
}): { state: ProgramState; events: RuleEvent[] } {
  const next: ProgramState = { ...opts.state };
  const events: RuleEvent[] = [];
  for (const slot of opts.day.slots) {
    const key = slotKey(slot);
    const current = next[key];
    const exercise = opts.exercises.get(slot.exerciseId);
    if (!current || !exercise) continue;
    const performed = opts.sets.filter((s) => s.exerciseId === slot.exerciseId);
    const { state, event } = applySlot({ program: opts.program, slot, exercise, state: current, performed, athlete: opts.athlete });
    next[key] = state;
    events.push(event);
  }
  return { state: next, events };
}

/**
 * Which failure stage a logged session was at. Prefers the planned reps when
 * the log has them; otherwise the stage with the same set count whose reps
 * are the most that were reached (so 10, 10, 9 reads as a missed 3×10, not
 * a 3×8).
 */
export function inferStage(stages: SetScheme[], performed: SetLog[]) {
  const target = performed[0]?.targetReps;
  const sameCount = stages.map((st, i) => ({ st, i })).filter(({ st }) => st.sets === performed.length);
  if (target !== undefined) {
    const exact = sameCount.find(({ st }) => st.reps === target);
    if (exact) return exact.i;
  }
  const most = Math.max(...performed.map((p) => p.reps));
  const reachable = sameCount.filter(({ st }) => st.reps <= most).sort((a, b) => b.st.reps - a.st.reps);
  return reachable[0]?.i ?? 0;
}

/**
 * Reconstructs where the lifter is from their log, for programs that weren't
 * run by the engine from the start (like an imported history): for each slot,
 * take the last session of its day, infer the weight and stage from what was
 * done, then apply that session to get the next targets.
 */
export function stateFromHistory(opts: {
  program: Program;
  sessions: Session[];
  exercises: Map<string, Exercise>;
  athlete: Athlete;
}): { state: ProgramState; lastEvents: Partial<Record<SlotKey, RuleEvent & { date: IsoDate }>> } {
  const state: ProgramState = {};
  const lastEvents: Partial<Record<SlotKey, RuleEvent & { date: IsoDate }>> = {};

  for (const day of opts.program.days) {
    const session = [...opts.sessions].reverse().find((s) => s.programDayId === day.id);
    if (!session) continue;
    for (const slot of day.slots) {
      const exercise = opts.exercises.get(slot.exerciseId);
      const performed = session.sets.filter((s) => s.exerciseId === slot.exerciseId);
      if (!exercise || !performed.length) continue;

      const { failure, progression } = rulesFor(opts.program, slot.tier);
      const stage = failure ? inferStage(failure.stages, performed) : 0;
      const inferred: SlotState = {
        weight: Math.max(...performed.map((p) => p.weight)),
        stage,
        ...(progression?.kind === "double-progression" ? { reps: Math.min(...performed.map((p) => p.reps)) } : {}),
      };
      const { state: next, event } = applySlot({ program: opts.program, slot, exercise, state: inferred, performed, athlete: opts.athlete });
      state[slotKey(slot)] = next;
      lastEvents[slotKey(slot)] = { ...event, date: session.date };
    }
  }
  return { state, lastEvents };
}
