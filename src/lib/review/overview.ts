import { bestBetween, liftTrend, weeklyBest, weeklySets } from "@/lib/calc/strength";
import type { Dataset } from "@/lib/dataset/dataset";
import type { IsoDate } from "@/lib/domain/types";

const MAIN_LIFTS = ["back-squat", "bench-press", "deadlift", "overhead-press"];
const DAY_MS = 86_400_000;

// A lift counts as flat when its best e1RM in the last 4 weeks is within 2%
// of the 4 weeks ending 8 weeks earlier. Deterministic, so it's code, not the AI.
const FLAT_THRESHOLD = 0.02;

export function daysBefore(date: IsoDate, days: number): IsoDate {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() - days * DAY_MS).toISOString().slice(0, 10);
}

export type LiftCard = {
  id: string;
  name: string;
  now: number | null;
  change: number | null;
  status: "Flat 8 wks" | "Down 8 wks" | null;
  recent: number[];
};

export function liftCards(data: Dataset): LiftCard[] {
  const trained = (id: string) => data.sessions.some((s) => s.sets.some((set) => set.exerciseId === id && set.weight > 0));
  let ids = MAIN_LIFTS.filter(trained);
  if (ids.length < 2) {
    // No classic main lifts: show the most-logged weighted exercises instead.
    const counts = new Map<string, number>();
    for (const s of data.sessions) for (const set of s.sets) if (set.weight > 0) counts.set(set.exerciseId, (counts.get(set.exerciseId) ?? 0) + 1);
    ids = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id]) => id);
  }

  return ids.map((id) => {
    const trend = liftTrend(data.sessions, id);
    const now = bestBetween(trend, daysBefore(data.end, 28), data.end);
    const then = bestBetween(trend, daysBefore(data.end, 84), daysBefore(data.end, 56));
    const change = now !== null && then !== null ? now / then - 1 : null;
    const status = change === null ? null : change <= -FLAT_THRESHOLD ? "Down 8 wks" : change < FLAT_THRESHOLD ? "Flat 8 wks" : null;
    return {
      id,
      name: data.exerciseById.get(id)?.name ?? id,
      now,
      change,
      status,
      recent: weeklyBest(trend.filter((p) => p.date >= daysBefore(data.end, 140))).map((w) => w.e1rm),
    };
  });
}

/** Weekly chest sets for the last 20 weeks, with the index of the dataset's marker week if any. */
export function chestWeeks(data: Dataset) {
  const weeks = [...weeklySets(data.sessions, data.exerciseById, "chest").entries()].slice(-20);
  const markIndex = data.marker ? weeks.findIndex(([week]) => week >= data.marker!.date) : -1;
  return { weeks, markIndex: markIndex >= 0 ? markIndex : undefined };
}
