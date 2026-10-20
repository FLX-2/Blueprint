import type { IsoDate, Session, SetLog } from "@/lib/domain/types";
import { roundToLoadable } from "@/lib/calc/strength";

/**
 * Deterministic training history for the sample athlete, Apr 2025 – Oct 2026.
 *
 * The story the demo is built around (docs/02-structure-and-flows.md, F4):
 * - Until Aug 9, 2026: GZCLP four days a week, plus incline press and dips,
 *   so about 14 chest sets a week. Bench climbs steadily from June.
 * - From Aug 10, 2026: three days a week, accessories dropped, about 8 chest
 *   sets a week. Bench top sets stay at 205 lb × 3–4, so bench stalls while
 *   squat keeps going up.
 */

export const HISTORY_START: IsoDate = "2025-04-07";
export const BENCH_BLOCK_START: IsoDate = "2026-06-01";
export const THREE_DAY_START: IsoDate = "2026-08-10";
export const HISTORY_END: IsoDate = "2026-10-16";

/** Weeks the athlete didn't train (vacations, holidays), by Monday. */
const WEEKS_OFF = new Set<IsoDate>(["2025-08-18", "2025-12-22", "2025-12-29"]);

// Estimated 1RM "capacity" by date: piecewise-linear anchors, in lb.
type Curve = Array<[IsoDate, number]>;
const capacity: Record<string, Curve> = {
  "back-squat": [["2025-04-07", 225], ["2026-05-31", 300], ["2026-08-09", 315], ["2026-10-16", 330]],
  deadlift: [["2025-04-07", 275], ["2026-05-31", 360], ["2026-08-09", 375], ["2026-10-16", 380]],
  "overhead-press": [["2025-04-07", 95], ["2026-05-31", 125], ["2026-08-09", 132], ["2026-10-16", 137]],
  "bench-press": [["2025-04-07", 150], ["2026-05-31", 192]],
  "lat-pulldown": [["2025-04-07", 100], ["2026-05-31", 140], ["2026-10-16", 150]],
  "dumbbell-row": [["2025-04-07", 45], ["2026-05-31", 70], ["2026-10-16", 80]],
  "incline-db-press": [["2025-04-07", 40], ["2026-05-31", 55], ["2026-08-09", 60]],
};

/** Bench T1 AMRAP sets in the June block: +5 lb a week (weight, reps). */
const BENCH_BLOCK: Array<[number, number]> = [
  [160, 6], [165, 6], [170, 5], [175, 5], [180, 5], [185, 5], [190, 4], [195, 4], [200, 4], [205, 4],
];

const DAY_MS = 86_400_000;

function toDate(iso: IsoDate) {
  return new Date(`${iso}T00:00:00Z`).getTime();
}

function toIso(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10);
}

function addDays(iso: IsoDate, days: number): IsoDate {
  return toIso(toDate(iso) + days * DAY_MS);
}

function weeksBetween(from: IsoDate, to: IsoDate) {
  return Math.floor((toDate(to) - toDate(from)) / (7 * DAY_MS));
}

function capacityOn(exerciseId: string, date: IsoDate) {
  const curve = capacity[exerciseId];
  const t = toDate(date);
  if (t <= toDate(curve[0][0])) return curve[0][1];
  for (let i = 1; i < curve.length; i++) {
    const [d0, v0] = curve[i - 1];
    const [d1, v1] = curve[i];
    if (t <= toDate(d1)) return v0 + ((v1 - v0) * (t - toDate(d0))) / (toDate(d1) - toDate(d0));
  }
  return curve[curve.length - 1][1];
}

/** Small seeded PRNG (mulberry32) so the history is identical on every build. */
function createRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Builder = { sets: SetLog[] };

function addSets(b: Builder, exerciseId: string, weight: number, reps: number[], targetReps?: number) {
  reps.forEach((r) => {
    b.sets.push({ exerciseId, setIndex: b.sets.filter((s) => s.exerciseId === exerciseId).length, weight, reps: r, targetReps });
  });
}

export function generateHistory(): Session[] {
  const rand = createRandom(20260810);
  const pick = <T,>(items: T[]) => items[Math.floor(rand() * items.length)];
  const sessions: Session[] = [];

  for (let monday = HISTORY_START; toDate(monday) <= toDate(HISTORY_END); monday = addDays(monday, 7)) {
    if (WEEKS_OFF.has(monday)) continue;

    const threeDay = toDate(monday) >= toDate(THREE_DAY_START);
    const benchBlock = toDate(monday) >= toDate(BENCH_BLOCK_START);
    const weekIndex = weeksBetween(HISTORY_START, monday);
    const deload = !benchBlock && weekIndex % 10 === 9;
    const intensity = deload ? 0.88 : 1;

    // Mon A1 · Tue B1 · Thu A2 · Fri B2   →   Mon A1 · Wed B1 · Fri A2
    const schedule: Array<[string, number]> = threeDay
      ? [["A1", 0], ["B1", 2], ["A2", 4]]
      : [["A1", 0], ["B1", 1], ["A2", 3], ["B2", 4]];

    for (const [dayId, offset] of schedule) {
      const date = addDays(monday, offset);
      if (toDate(date) > toDate(HISTORY_END)) break;
      const b: Builder = { sets: [] };

      const t1 = (id: string) => {
        const amrap = pick([3, 4, 5, 6]);
        const w = roundToLoadable((capacityOn(id, date) * intensity) / (1 + amrap / 30), 5);
        addSets(b, id, w, [3, 3, 3, 3, deload ? 3 : amrap], 3);
      };
      const t2 = (id: string) => {
        const w = roundToLoadable(capacityOn(id, date) * 0.62 * intensity, 5);
        addSets(b, id, w, [10, 10, rand() < 0.2 ? 9 : 10], 10);
      };
      const t3 = (id: string) => {
        const w = roundToLoadable(capacityOn(id, date) * 0.55, 5);
        addSets(b, id, w, [15, 15, 15 + Math.floor(rand() * 9)], 15);
      };

      if (dayId === "A1") {
        t1("back-squat");
        if (benchBlock) {
          const w = threeDay ? 135 : 115 + 5 * Math.floor(weeksBetween(BENCH_BLOCK_START, monday) / 2);
          const reps = threeDay ? [10, 10, 9] : [10, 10, 10];
          // Some three-day weeks get an extra back-off set: 9 chest sets instead of 8.
          if (threeDay && rand() < 0.25) reps.push(8);
          addSets(b, "bench-press", w, reps, 10);
        } else {
          t2("bench-press");
        }
        t3("lat-pulldown");
      } else if (dayId === "B1") {
        t1("overhead-press");
        t2("deadlift");
        t3("dumbbell-row");
        if (!threeDay) {
          const w = roundToLoadable(capacityOn("incline-db-press", date) * 0.7, 5);
          addSets(b, "incline-db-press", w, rand() < 0.15 ? [10, 10, 10, 9] : [10, 10, 9], 10);
        }
      } else if (dayId === "A2") {
        if (benchBlock) {
          const week = weeksBetween(BENCH_BLOCK_START, monday);
          const [w, amrap] = threeDay ? [205, week % 2 === 0 ? 3 : 4] : BENCH_BLOCK[Math.min(week, BENCH_BLOCK.length - 1)];
          addSets(b, "bench-press", w, [3, 3, 3, 3, amrap], 3);
        } else {
          t1("bench-press");
        }
        t2("back-squat");
        t3("lat-pulldown");
      } else {
        t1("deadlift");
        t2("overhead-press");
        t3("dumbbell-row");
        addSets(b, "dips", 0, rand() < 0.15 ? [12, 10] : [12, 10, 8], 10);
      }

      sessions.push({
        id: `s-${date}`,
        date,
        programDayId: dayId,
        durationMin: threeDay ? 48 + Math.floor(rand() * 10) : 58 + Math.floor(rand() * 14),
        sets: b.sets,
      });
    }
  }

  return sessions;
}
