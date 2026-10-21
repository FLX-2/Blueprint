import { epley, liftTrend, roundToLoadable } from "@/lib/calc/strength";
import { formatScheme } from "@/lib/domain/describe";
import type { Athlete, Exercise, GymProfile, MuscleGroup, Program, ProgramDay, Session, SetScheme } from "@/lib/domain/types";
import { prescribe, type Prescription, type ProgramState, type RuleEvent, type SlotKey } from "@/lib/engine/engine";

/**
 * Bend the week (F3): temporary changes to upcoming sessions when life gets
 * in the way. The AI proposes; this code checks every change against the
 * day, the gym's equipment and the library, sets weights from the log, and
 * works out what the week loses. Changes never touch the program or the
 * rule engine's state: a swapped or skipped lift simply keeps its target.
 */

export type SlotChange =
  | {
      slotKey: SlotKey;
      kind: "swap";
      exerciseId: string;
      scheme: SetScheme;
      weight: number | null;
      /** Set when there's no log for the substitute and the weight is estimated from the lift it replaces. */
      estimatedFrom?: string;
      reason: string;
    }
  | { slotKey: SlotKey; kind: "reduce"; sets: number; reason: string }
  | { slotKey: SlotKey; kind: "skip"; reason: string };

/** Changes for one upcoming occurrence of a day. Consumed when that day is trained. */
export type DayAdjustment = { id: string; dayId: string; constraint: string; changes: SlotChange[] };

/** What the model proposes; positions index into the upcoming sessions it was shown. */
export type ProposedChange = {
  position: number;
  slot_key: string;
  kind: "swap" | "reduce" | "skip";
  exercise_id: string | null;
  sets: number | null;
  reps: number | null;
  amrap_last: boolean | null;
  reason: string;
};

export type Upcoming = { position: number; day: ProgramDay; prescriptions: Prescription[] };

/** The next `count` sessions in rotation, as the engine prescribes them today. */
export function upcomingSessions(program: Program, state: ProgramState, dayIndex: number, athlete: Athlete, count = program.days.length): Upcoming[] {
  return Array.from({ length: count }, (_, position) => {
    const day = program.days[(dayIndex + position) % program.days.length];
    return { position, day, prescriptions: prescribe(program, day, state, athlete) };
  });
}

const DAY_MS = 86_400_000;

/** A starting weight for a substitute: ~90% of what the log says, capped by the gym's dumbbells. */
export function substituteWeight(opts: {
  exercise: Exercise;
  reps: number;
  sessions: Session[];
  end: string;
  athlete: Athlete;
  gym: GymProfile | null;
}): number | null {
  const { exercise, reps, sessions, end, athlete, gym } = opts;
  if (exercise.equipment === "bodyweight") return 0;
  const since = new Date(new Date(`${end}T00:00:00Z`).getTime() - 84 * DAY_MS).toISOString().slice(0, 10);
  const recent = liftTrend(sessions, exercise.id).filter((p) => p.date >= since && p.set.weight > 0);
  if (!recent.length) return null;
  const best = Math.max(...recent.map((p) => p.e1rm));
  let weight = roundToLoadable((best / (1 + reps / 30)) * 0.9, athlete.smallestPlatePair);
  if (exercise.equipment === "dumbbell" && gym?.maxDumbbell !== undefined) weight = Math.min(weight, gym.maxDumbbell);
  return weight;
}

/** Rough load of a substitute relative to the barbell lift it replaces (dumbbells are per hand). */
const EQUIPMENT_FACTOR: Record<Exclude<Exercise["equipment"], "bodyweight">, number> = { barbell: 1, dumbbell: 0.35, machine: 0.8, cable: 0.6 };

/**
 * With no log for the substitute, a conservative estimate from the lift it
 * replaces: that lift's best recent e1RM (or today's target), scaled for the
 * equipment, at 90% for the new rep target. Labeled as an estimate in the UI.
 */
export function estimateWeight(opts: {
  original: Exercise;
  originalWeight: number | null;
  originalReps: number;
  replacement: Exercise;
  reps: number;
  sessions: Session[];
  end: string;
  athlete: Athlete;
  gym: GymProfile | null;
}): number | null {
  const { original, replacement, reps, gym } = opts;
  if (replacement.equipment === "bodyweight" || original.equipment === "bodyweight") return null;
  const since = new Date(new Date(`${opts.end}T00:00:00Z`).getTime() - 84 * DAY_MS).toISOString().slice(0, 10);
  const recent = liftTrend(opts.sessions, original.id).filter((p) => p.date >= since && p.set.weight > 0);
  const base = recent.length ? Math.max(...recent.map((p) => p.e1rm)) : opts.originalWeight ? epley(opts.originalWeight, opts.originalReps) : 0;
  if (!base) return null;
  const factor = EQUIPMENT_FACTOR[replacement.equipment] / EQUIPMENT_FACTOR[original.equipment];
  let weight = roundToLoadable((base / (1 + reps / 30)) * 0.9 * factor, opts.athlete.smallestPlatePair);
  if (replacement.equipment === "dumbbell" && gym?.maxDumbbell !== undefined) weight = Math.min(weight, gym.maxDumbbell);
  return weight > 0 ? weight : null;
}

export type CheckedChange = { position: number; dayId: string; change: SlotChange; warnings: string[] };
export type RejectedChange = { proposal: ProposedChange; why: string };

/** Turns proposals into changes, or explains why one can't be used. */
export function checkProposals(opts: {
  proposals: ProposedChange[];
  upcoming: Upcoming[];
  exercises: Map<string, Exercise>;
  gym: GymProfile | null;
  sessions: Session[];
  end: string;
  athlete: Athlete;
}): { accepted: CheckedChange[]; rejected: RejectedChange[] } {
  const accepted: CheckedChange[] = [];
  const rejected: RejectedChange[] = [];
  const seen = new Set<string>();
  const accept = (c: CheckedChange) => {
    seen.add(`${c.position}|${c.change.slotKey}`);
    accepted.push(c);
  };

  for (const p of opts.proposals) {
    const reject = (why: string) => rejected.push({ proposal: p, why });
    const session = opts.upcoming[p.position];
    if (!session) {
      reject("It refers to a session that isn’t coming up.");
      continue;
    }
    const prescription = session.prescriptions.find((x) => x.key === p.slot_key);
    if (!prescription) {
      reject(`Day ${session.day.name} has no ${p.slot_key}.`);
      continue;
    }
    const dupe = `${p.position}|${p.slot_key}`;
    if (seen.has(dupe)) {
      reject("A second change to the same exercise on the same day.");
      continue;
    }
    const original = opts.exercises.get(prescription.slot.exerciseId)!;
    const currentSets = prescription.sets?.length ?? prescription.slot.scheme.sets;

    if (p.kind === "skip") {
      accept({ position: p.position, dayId: session.day.id, change: { slotKey: prescription.key, kind: "skip", reason: p.reason }, warnings: [] });
      continue;
    }

    if (p.kind === "reduce") {
      if (p.sets === null || !Number.isInteger(p.sets) || p.sets < 1 || p.sets >= currentSets) {
        reject(`Fewer sets has to be between 1 and ${currentSets - 1}.`);
        continue;
      }
      accept({ position: p.position, dayId: session.day.id, change: { slotKey: prescription.key, kind: "reduce", sets: p.sets, reason: p.reason }, warnings: [] });
      continue;
    }

    // Swap
    const replacement = p.exercise_id ? opts.exercises.get(p.exercise_id) : undefined;
    if (!replacement) {
      reject(`“${p.exercise_id ?? "—"}” isn’t in the exercise library.`);
      continue;
    }
    if (opts.gym && !opts.gym.equipment.includes(replacement.equipment)) {
      reject(`${opts.gym.name} has no ${replacement.equipment} for ${replacement.name}.`);
      continue;
    }
    const sets = p.sets ?? currentSets;
    const reps = p.reps ?? prescription.slot.scheme.reps;
    if (sets < 1 || sets > 10 || reps < 1 || reps > 30) {
      reject("Sets or reps are out of range.");
      continue;
    }
    const warnings: string[] = [];
    const overlap = replacement.muscles.some((m) => original.muscles.includes(m));
    if (replacement.pattern !== original.pattern && !overlap) warnings.push(`${replacement.name} trains different muscles than ${original.name}.`);
    if (sets > currentSets) warnings.push("Adds sets compared with the plan.");
    const logged = substituteWeight({ exercise: replacement, reps, sessions: opts.sessions, end: opts.end, athlete: opts.athlete, gym: opts.gym });
    const estimated =
      logged === null
        ? estimateWeight({
            original,
            originalWeight: prescription.sets?.at(-1)?.weight ?? null,
            originalReps: prescription.slot.scheme.reps,
            replacement,
            reps,
            sessions: opts.sessions,
            end: opts.end,
            athlete: opts.athlete,
            gym: opts.gym,
          })
        : null;
    accept({
      position: p.position,
      dayId: session.day.id,
      change: {
        slotKey: prescription.key,
        kind: "swap",
        exerciseId: replacement.id,
        scheme: { sets, reps, amrapLast: p.amrap_last ?? false },
        weight: logged ?? estimated,
        ...(estimated !== null ? { estimatedFrom: original.name } : {}),
        reason: p.reason,
      },
      warnings,
    });
  }
  return { accepted, rejected };
}

/** Prescriptions with a day's changes applied. Skipped slots drop out. */
export function applyChanges(prescriptions: Prescription[], changes: SlotChange[]): Array<Prescription & { change?: SlotChange }> {
  const out: Array<Prescription & { change?: SlotChange }> = [];
  for (const p of prescriptions) {
    const change = changes.find((c) => c.slotKey === p.key);
    if (!change) {
      out.push(p);
    } else if (change.kind === "reduce") {
      out.push({ ...p, sets: p.sets?.slice(0, change.sets) ?? null, scheme: `${change.sets}×${p.slot.scheme.reps}${p.slot.scheme.amrapLast ? "+" : ""}`, change });
    } else if (change.kind === "swap") {
      const weight = change.weight ?? 0;
      out.push({
        ...p,
        key: `${p.slot.tier}:${change.exerciseId}~swap`,
        slot: { ...p.slot, exerciseId: change.exerciseId, scheme: change.scheme },
        sets: Array.from({ length: change.scheme.sets }, (_, i) => ({ weight, reps: change.scheme.reps, amrap: change.scheme.amrapLast && i === change.scheme.sets - 1 })),
        scheme: formatScheme(change.scheme),
        note: undefined, // the original lift's note (stage, cycle week) doesn't apply to its substitute
        change,
      });
    } else {
      out.push({ ...p, change }); // kept so the diff can show it; gym mode filters skips out
    }
  }
  return out;
}

export type Effects = {
  muscles: Array<{ muscle: MuscleGroup; before: number; after: number }>;
  /** Lifts that keep their current target because they're swapped or skipped. */
  paused: string[];
};

const MUSCLES: MuscleGroup[] = ["legs", "chest", "back", "shoulders", "arms"];

/** What the changes do to the coming sessions, in sets per muscle group. */
export function effectsOf(upcoming: Upcoming[], changes: CheckedChange[], exercises: Map<string, Exercise>): Effects {
  const count = (prescriptions: Array<Prescription & { change?: SlotChange }>) => {
    const totals = new Map<MuscleGroup, number>();
    for (const p of prescriptions) {
      if (p.change?.kind === "skip") continue;
      const sets = p.sets?.length ?? p.slot.scheme.sets;
      for (const m of exercises.get(p.slot.exerciseId)?.muscles ?? []) totals.set(m, (totals.get(m) ?? 0) + sets);
    }
    return totals;
  };
  const before = new Map<MuscleGroup, number>();
  const after = new Map<MuscleGroup, number>();
  for (const u of upcoming) {
    const dayChanges = changes.filter((c) => c.position === u.position).map((c) => c.change);
    for (const [m, n] of count(u.prescriptions)) before.set(m, (before.get(m) ?? 0) + n);
    for (const [m, n] of count(applyChanges(u.prescriptions, dayChanges))) after.set(m, (after.get(m) ?? 0) + n);
  }
  const paused = new Set<string>();
  for (const c of changes) {
    if (c.change.kind === "reduce") continue;
    const u = upcoming[c.position];
    const p = u.prescriptions.find((x) => x.key === c.change.slotKey);
    if (p) paused.add(`${exercises.get(p.slot.exerciseId)?.name} (${p.slot.tier})`);
  }
  return {
    muscles: MUSCLES.map((muscle) => ({ muscle, before: before.get(muscle) ?? 0, after: after.get(muscle) ?? 0 })).filter((m) => m.before !== m.after),
    paused: [...paused],
  };
}

/** A constraint for quoting inside a sentence, without its closing punctuation. */
export const quoteConstraint = (text: string) => `“${text.trim().replace(/[.!?]+$/, "")}”`;

/** Pain and injury get a fixed safety note, whatever the model says. */
export const mentionsPain = (text: string) => /\b(pain|painful|hurt|hurts|injur\w*|tweak\w*|strain\w*|sprain\w*|aches?|aching)\b/i.test(text);

/** Groups checked changes into day adjustments, in rotation order. */
export function toAdjustments(changes: CheckedChange[], upcoming: Upcoming[], constraint: string, idPrefix: string): DayAdjustment[] {
  return upcoming
    .map((u) => ({
      id: `${idPrefix}-${u.position}`,
      dayId: u.day.id,
      constraint,
      changes: changes.filter((c) => c.position === u.position).map((c) => c.change),
    }))
    .filter((a) => a.changes.length);
}

/** Rewrites the engine's "skipped" events for lifts that were swapped or skipped on purpose. */
export function explainAdjusted(
  events: RuleEvent[],
  adjustment: DayAdjustment | undefined,
  exercises: Map<string, Exercise>,
  slotExercise: (key: SlotKey) => string,
): Array<RuleEvent & { swapped?: boolean }> {
  if (!adjustment) return events;
  return events.map((e) => {
    const change = adjustment.changes.find((c) => c.slotKey === e.key);
    if (!change || e.kind !== "skipped" || change.kind === "reduce") return e;
    const original = exercises.get(slotExercise(e.key))?.name ?? e.key;
    const target = `${e.from.weight} lb`;
    return {
      ...e,
      swapped: change.kind === "swap",
      message:
        change.kind === "swap"
          ? `Swapped for ${exercises.get(change.exerciseId)?.name ?? change.exerciseId} this time, so ${original} stays at ${target}.`
          : `Skipped this time, so ${original} stays at ${target}.`,
    };
  });
}
