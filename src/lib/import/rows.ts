import type { IsoDate, Session, Unit } from "@/lib/domain/types";
import type { ColumnMap } from "./formats";

/** One working set read from the file, before exercise names are resolved. */
export type ImportedSet = {
  date: IsoDate;
  /** Groups rows into sessions: raw date/time cell + workout name. */
  workoutKey: string;
  exerciseName: string;
  /** Always stored in lb. */
  weight: number;
  reps: number;
};

export type SkipReason = "warmup" | "no-reps" | "bad-date" | "no-exercise";

export const SKIP_LABELS: Record<SkipReason, string> = {
  warmup: "warm-up sets",
  "no-reps": "rows without reps (cardio, timed sets)",
  "bad-date": "rows with a date we couldn’t read",
  "no-exercise": "rows without an exercise name",
};

const KG_TO_LB = 2.20462;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function iso(year: number, month: number, day: number): IsoDate | null {
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1990 || year > 2100) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Reads the date formats real exports use: "2026-08-10 07:00:00" (Strong),
 * "15 Oct 2024, 07:30" (Hevy), "Oct 15, 2024", and "8/10/2026" (US order
 * unless the first number can't be a month).
 */
export function parseDateLoose(raw: string): IsoDate | null {
  const s = raw.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return iso(+m[1], +m[2], +m[3]);

  m = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})/);
  if (m) {
    const [a, b] = [+m[1], +m[2]];
    return a > 12 ? iso(+m[3], b, a) : iso(+m[3], a, b);
  }

  m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\.?,?\s+(\d{4})/);
  if (m) {
    const month = MONTHS.indexOf(m[2].toLowerCase()) + 1;
    return month ? iso(+m[3], month, +m[1]) : null;
  }

  m = s.match(/^([A-Za-z]{3})[A-Za-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/);
  if (m) {
    const month = MONTHS.indexOf(m[1].toLowerCase()) + 1;
    return month ? iso(+m[3], month, +m[2]) : null;
  }
  return null;
}

function toNumber(raw: string | undefined) {
  if (raw === undefined) return NaN;
  const cleaned = raw.trim().replace(/[^\d.,-]/g, "");
  if (cleaned === "") return NaN;
  // "62,5" (decimal comma) → 62.5; "1,000" → 1000
  const normalized = /^\d+,\d{1,2}$/.test(cleaned) ? cleaned.replace(",", ".") : cleaned.replace(/,/g, "");
  return Number(normalized);
}

export function readRows(rows: string[][], map: ColumnMap, unit: Unit) {
  const sets: ImportedSet[] = [];
  const skipped: Record<SkipReason, number> = { warmup: 0, "no-reps": 0, "bad-date": 0, "no-exercise": 0 };

  for (const row of rows) {
    const name = row[map.exercise]?.trim() ?? "";
    if (!name) {
      skipped["no-exercise"]++;
      continue;
    }
    const setType = map.setType !== undefined ? row[map.setType]?.trim().toLowerCase() : "";
    const setOrder = map.setOrder !== undefined ? row[map.setOrder]?.trim().toUpperCase() : "";
    if (setType === "warmup" || setOrder === "W") {
      skipped.warmup++;
      continue;
    }
    const reps = toNumber(row[map.reps]);
    if (!Number.isFinite(reps) || reps <= 0) {
      skipped["no-reps"]++;
      continue;
    }
    const rawDate = row[map.date] ?? "";
    const date = parseDateLoose(rawDate);
    if (!date) {
      skipped["bad-date"]++;
      continue;
    }
    const rawWeight = toNumber(row[map.weight]);
    const weight = Number.isFinite(rawWeight) && rawWeight > 0 ? rawWeight : 0; // blank = bodyweight
    const workout = map.workout !== undefined ? (row[map.workout] ?? "") : "";

    sets.push({
      date,
      workoutKey: `${rawDate.trim()}|${workout.trim()}`,
      exerciseName: name,
      weight: unit === "kg" ? Math.round(weight * KG_TO_LB * 10) / 10 : weight,
      reps: Math.round(reps),
    });
  }
  return { sets, skipped };
}

export type ImportSummary = {
  sessions: number;
  sets: number;
  firstDate: IsoDate | null;
  lastDate: IsoDate | null;
  /** Distinct exercise names with how many sets used each, most used first. */
  names: Array<{ name: string; sets: number }>;
};

export function summarize(sets: ImportedSet[]): ImportSummary {
  const counts = new Map<string, number>();
  const workouts = new Set<string>();
  let firstDate: IsoDate | null = null;
  let lastDate: IsoDate | null = null;
  for (const s of sets) {
    counts.set(s.exerciseName, (counts.get(s.exerciseName) ?? 0) + 1);
    workouts.add(s.workoutKey);
    if (!firstDate || s.date < firstDate) firstDate = s.date;
    if (!lastDate || s.date > lastDate) lastDate = s.date;
  }
  return {
    sessions: workouts.size,
    sets: sets.length,
    firstDate,
    lastDate,
    names: [...counts.entries()].map(([name, n]) => ({ name, sets: n })).sort((a, b) => b.sets - a.sets),
  };
}

/** Groups sets into sessions and resolves each name to an exercise id. */
export function buildSessions(sets: ImportedSet[], exerciseIdFor: (name: string) => string): Session[] {
  const byWorkout = new Map<string, { date: IsoDate; sets: ImportedSet[] }>();
  for (const s of sets) {
    const workout = byWorkout.get(s.workoutKey) ?? { date: s.date, sets: [] };
    workout.sets.push(s);
    byWorkout.set(s.workoutKey, workout);
  }
  const workouts = [...byWorkout.entries()].sort(([ka, a], [kb, b]) =>
    a.date === b.date ? ka.localeCompare(kb) : a.date.localeCompare(b.date),
  );

  return workouts.map(([, workout], i) => {
    const perExercise = new Map<string, number>();
    return {
      id: `imp-${i}`,
      date: workout.date,
      durationMin: 0,
      sets: workout.sets.map((s) => {
        const exerciseId = exerciseIdFor(s.exerciseName);
        const setIndex = perExercise.get(exerciseId) ?? 0;
        perExercise.set(exerciseId, setIndex + 1);
        return { exerciseId, setIndex, weight: s.weight, reps: s.reps };
      }),
    };
  });
}
