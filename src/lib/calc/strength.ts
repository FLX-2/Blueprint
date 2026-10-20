import type { Exercise, IsoDate, MuscleGroup, Session, SetLog } from "@/lib/domain/types";

/** Estimated one-rep max, Epley: weight × (1 + reps / 30). A single is its own 1RM. */
export function epley(weight: number, reps: number) {
  if (reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

/** The set with the highest estimated 1RM for an exercise in a session. */
export function topSet(session: Session, exerciseId: string): SetLog | null {
  let best: SetLog | null = null;
  for (const set of session.sets) {
    if (set.exerciseId !== exerciseId) continue;
    if (!best || epley(set.weight, set.reps) > epley(best.weight, best.reps)) best = set;
  }
  return best;
}

export type TrendPoint = { date: IsoDate; e1rm: number; set: SetLog };

/** One point per session that included the exercise: its best estimated 1RM. */
export function liftTrend(sessions: Session[], exerciseId: string): TrendPoint[] {
  const points: TrendPoint[] = [];
  for (const session of sessions) {
    const set = topSet(session, exerciseId);
    if (set) points.push({ date: session.date, e1rm: epley(set.weight, set.reps), set });
  }
  return points;
}

/** Best estimated 1RM within [from, to], or null if the lift wasn't trained. */
export function bestBetween(points: TrendPoint[], from: IsoDate, to: IsoDate) {
  let best: number | null = null;
  for (const p of points) {
    if (p.date >= from && p.date <= to && (best === null || p.e1rm > best)) best = p.e1rm;
  }
  return best;
}

/**
 * Best e1RM per week. Smooths out heavy/light days (T1 vs T2) so trend lines
 * show progress, not the program's rotation.
 */
export function weeklyBest(points: TrendPoint[]): Array<{ week: IsoDate; e1rm: number }> {
  const weeks = new Map<IsoDate, number>();
  for (const p of points) {
    const week = weekStart(p.date);
    weeks.set(week, Math.max(weeks.get(week) ?? 0, p.e1rm));
  }
  return [...weeks.entries()].map(([week, e1rm]) => ({ week, e1rm }));
}

/** Monday of the week containing `date` (ISO weeks start Monday). */
export function weekStart(date: IsoDate): IsoDate {
  const d = new Date(`${date}T00:00:00Z`);
  const offset = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
}

/** Working sets per muscle group per week, keyed by week start. */
export function weeklySets(
  sessions: Session[],
  exercises: Map<string, Exercise>,
  muscle: MuscleGroup,
): Map<IsoDate, number> {
  const weeks = new Map<IsoDate, number>();
  for (const session of sessions) {
    const week = weekStart(session.date);
    const count = session.sets.filter((s) => exercises.get(s.exerciseId)?.muscles.includes(muscle)).length;
    weeks.set(week, (weeks.get(week) ?? 0) + count);
  }
  return weeks;
}

/** Rounds a target weight down to what the athlete can load. */
export function roundToLoadable(weight: number, step: number) {
  return Math.floor(weight / step) * step;
}
