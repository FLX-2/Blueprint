import { epley } from "@/lib/calc/strength";
import type { Athlete, Exercise, IsoDate, Program, ProgramDay, Session, SetLog, Tier } from "@/lib/domain/types";
import { applySession, type Prescription, type ProgramState, type RuleEvent, type SlotKey } from "@/lib/engine/engine";

/**
 * A workout in progress, and what happens when it's finished. Pure functions
 * only: the gym screen keeps an ActiveSession in state and saves it on every
 * change, so a reload, a dead battery or a dropped connection loses nothing.
 */

export type DraftSet = {
  weight: number;
  reps: number;
  targetReps: number;
  amrap: boolean;
  done: boolean;
};

export type DraftSlot = {
  key: SlotKey;
  exerciseId: string;
  tier: Tier;
  scheme: string;
  sets: DraftSet[];
};

export type ActiveSession = {
  id: string;
  programId: string;
  dayId: string;
  startedAt: string;
  slots: DraftSlot[];
  /** Where the lifter is: slot index and set index. */
  cursor: { slot: number; set: number };
  /** Epoch ms when the current rest ends, or null when not resting. */
  restUntil: number | null;
  /** The Bend-the-week adjustment this session follows, if any. */
  adjustmentId?: string;
};

/** Default rest by tier, in seconds: heavy work gets longer. */
export const REST_SECONDS: Record<Tier, number> = { T1: 180, T2: 120, T3: 75 };

export function startSession(opts: {
  id: string;
  programId: string;
  day: ProgramDay;
  prescriptions: Prescription[];
  now: Date;
  adjustmentId?: string;
}): ActiveSession {
  return {
    id: opts.id,
    ...(opts.adjustmentId ? { adjustmentId: opts.adjustmentId } : {}),
    programId: opts.programId,
    dayId: opts.day.id,
    startedAt: opts.now.toISOString(),
    slots: opts.prescriptions
      .filter((p) => p.sets)
      .map((p) => ({
        key: p.key,
        exerciseId: p.slot.exerciseId,
        tier: p.slot.tier,
        scheme: p.scheme,
        sets: p.sets!.map((s) => ({ weight: s.weight, reps: s.reps, targetReps: s.reps, amrap: s.amrap, done: false })),
      })),
    cursor: { slot: 0, set: 0 },
    restUntil: null,
  };
}

/** The next set not done yet, starting from the cursor and wrapping around. */
function nextOpen(session: ActiveSession, from: { slot: number; set: number }) {
  const order: Array<{ slot: number; set: number }> = [];
  session.slots.forEach((s, si) => s.sets.forEach((_, i) => order.push({ slot: si, set: i })));
  const start = order.findIndex((p) => p.slot === from.slot && p.set === from.set);
  for (let k = 1; k <= order.length; k++) {
    const p = order[(start + k + order.length) % order.length];
    if (!session.slots[p.slot].sets[p.set].done) return p;
  }
  return from;
}

export const isComplete = (session: ActiveSession) => session.slots.every((s) => s.sets.every((x) => x.done));

/** Logs the set at the cursor with what was actually lifted, starts the rest timer, and moves on. */
export function logSet(session: ActiveSession, done: { weight: number; reps: number }, now: number): ActiveSession {
  const { slot, set } = session.cursor;
  const slots = session.slots.map((s, si) =>
    si !== slot ? s : { ...s, sets: s.sets.map((x, i) => (i === set ? { ...x, weight: done.weight, reps: done.reps, done: true } : x)) },
  );
  // Later sets of the same exercise follow a weight change (a lifter who drops the bar 10 lb keeps it there).
  const current = session.slots[slot].sets[set];
  if (done.weight !== current.weight) {
    slots[slot] = { ...slots[slot], sets: slots[slot].sets.map((x, i) => (i > set && !x.done ? { ...x, weight: done.weight } : x)) };
  }
  const next: ActiveSession = { ...session, slots };
  const finished = isComplete(next);
  return {
    ...next,
    cursor: finished ? session.cursor : nextOpen(next, session.cursor),
    restUntil: finished ? null : now + REST_SECONDS[session.slots[slot].tier] * 1000,
  };
}

/** Undoes the most recently logged set (the last done set before the cursor). */
export function undoLast(session: ActiveSession): ActiveSession {
  const order: Array<{ slot: number; set: number }> = [];
  session.slots.forEach((s, si) => s.sets.forEach((_, i) => order.push({ slot: si, set: i })));
  const cur = order.findIndex((p) => p.slot === session.cursor.slot && p.set === session.cursor.set);
  for (let k = 0; k <= order.length; k++) {
    const p = order[(cur - k + order.length * 2) % order.length];
    if (session.slots[p.slot].sets[p.set].done) {
      return {
        ...session,
        cursor: p,
        restUntil: null,
        slots: session.slots.map((s, si) => (si !== p.slot ? s : { ...s, sets: s.sets.map((x, i) => (i === p.set ? { ...x, done: false } : x)) })),
      };
    }
  }
  return session;
}

export function moveTo(session: ActiveSession, slot: number): ActiveSession {
  const set = session.slots[slot].sets.findIndex((x) => !x.done);
  return { ...session, cursor: { slot, set: set === -1 ? session.slots[slot].sets.length - 1 : set }, restUntil: null };
}

/** The logged session, as history keeps it: only sets that were done. */
export function toLoggedSession(session: ActiveSession, date: IsoDate, now: Date): Session {
  const sets: SetLog[] = session.slots.flatMap((s) =>
    s.sets
      .filter((x) => x.done)
      .map((x, i) => ({ exerciseId: s.exerciseId, setIndex: i, weight: x.weight, reps: x.reps, targetReps: x.targetReps })),
  );
  return {
    id: session.id,
    date,
    programDayId: session.dayId,
    durationMin: Math.max(1, Math.round((now.getTime() - new Date(session.startedAt).getTime()) / 60_000)),
    sets,
  };
}

export type PersonalBest = { exerciseId: string; e1rm: number; previous: number | null; set: { weight: number; reps: number } };

/** New best estimated 1RMs in this session, against everything logged before it. */
export function personalBests(session: Session, history: Session[]): PersonalBest[] {
  const out: PersonalBest[] = [];
  for (const exerciseId of new Set(session.sets.map((s) => s.exerciseId))) {
    const mine = session.sets.filter((s) => s.exerciseId === exerciseId && s.weight > 0);
    if (!mine.length) continue;
    const top = mine.reduce((a, b) => (epley(b.weight, b.reps) > epley(a.weight, a.reps) ? b : a));
    const best = epley(top.weight, top.reps);
    const before = history.flatMap((h) => h.sets.filter((s) => s.exerciseId === exerciseId && s.weight > 0).map((s) => epley(s.weight, s.reps)));
    const previous = before.length ? Math.max(...before) : null;
    if (previous === null || best > previous) out.push({ exerciseId, e1rm: best, previous, set: { weight: top.weight, reps: top.reps } });
  }
  return out;
}

export type SessionSummary = {
  sessionId: string;
  date: IsoDate;
  dayName: string;
  durationMin: number;
  setsDone: number;
  setsPlanned: number;
  /** Total weight moved, lb. */
  volume: number;
  /** `swapped`: the lift was swapped on purpose (Bend the week), so it held. */
  events: Array<RuleEvent & { swapped?: boolean }>;
  bests: PersonalBest[];
};

/** Finishes a session: logs it, runs the rules, and summarizes what changed. */
export function finishSession(opts: {
  session: ActiveSession;
  program: Program;
  state: ProgramState;
  exercises: Map<string, Exercise>;
  athlete: Athlete;
  history: Session[];
  date: IsoDate;
  now: Date;
}): { logged: Session; state: ProgramState; summary: SessionSummary } {
  const day = opts.program.days.find((d) => d.id === opts.session.dayId)!;
  const logged = toLoggedSession(opts.session, opts.date, opts.now);
  const { state, events } = applySession({ program: opts.program, day, state: opts.state, sets: logged.sets, exercises: opts.exercises, athlete: opts.athlete });
  return {
    logged,
    state,
    summary: {
      sessionId: logged.id,
      date: opts.date,
      dayName: day.name,
      durationMin: logged.durationMin,
      setsDone: logged.sets.length,
      setsPlanned: opts.session.slots.reduce((n, s) => n + s.sets.length, 0),
      volume: logged.sets.reduce((n, s) => n + s.weight * s.reps, 0),
      events,
      bests: personalBests(logged, opts.history),
    },
  };
}
