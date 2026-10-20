import type { IsoDate, Session } from "@/lib/domain/types";
import { getExercise } from "./exercises";

const HEADER = "Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE";

/**
 * Names the athlete typed in an older app, before switching. None of these
 * are in the exercise library as written, so importing the demo CSV has real
 * cleanup to do: some are near-spellings, one needs actual knowledge.
 */
const MESSY_NAMES: Record<string, string> = {
  "back-squat": "Squat - Back (Barbell)",
  "bench-press": "Flat Bench (BB)",
  deadlift: "Deadlifts",
  "overhead-press": "Military Press",
  "lat-pulldown": "Pull Down (Cable)",
  "dumbbell-row": "One Arm DB Row",
  "incline-db-press": "Incline DB Bench",
  dips: "Dips (Chest)",
};

/** Before this date the athlete used another app with its own exercise names. */
export const OLD_APP_UNTIL: IsoDate = "2025-10-01";
/** Before this date (and after the old app) Strong's default names were used. */
export const STRONG_NAMES_UNTIL: IsoDate = "2026-01-01";

function nameFor(exerciseId: string, date: IsoDate) {
  const exercise = getExercise(exerciseId);
  if (date < OLD_APP_UNTIL) return MESSY_NAMES[exerciseId] ?? exercise.name;
  if (date < STRONG_NAMES_UNTIL) return exercise.aliases[0];
  return exercise.name;
}

/**
 * Exports sessions as a Strong-style CSV, for testing the history import (F5).
 * The same lift appears under several names over time, as it does in real
 * exports, so the import has duplicates to clean up.
 */
export function toStrongCsv(sessions: Session[]) {
  const rows = [HEADER];
  for (const session of sessions) {
    for (const set of session.sets) {
      rows.push(
        [
          `${session.date} 07:00:00`,
          `"Day ${session.programDayId ?? ""}"`,
          `${session.durationMin}m`,
          `"${nameFor(set.exerciseId, session.date)}"`,
          set.setIndex + 1,
          set.weight,
          set.reps,
          0,
          0,
          "",
          "",
          "",
        ].join(","),
      );
    }
  }
  return `${rows.join("\n")}\n`;
}
