import type { Session } from "@/lib/domain/types";
import { getExercise } from "./exercises";

const HEADER = "Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE";

/**
 * Exports sessions in a Strong-style CSV, for testing the history import (F5).
 * Older sessions use each exercise's first alias, as if logged in another app,
 * so the import has real duplicate names to clean up.
 */
export function toStrongCsv(sessions: Session[], aliasBefore = "2026-01-01") {
  const rows = [HEADER];
  for (const session of sessions) {
    for (const set of session.sets) {
      const exercise = getExercise(set.exerciseId);
      const name = session.date < aliasBefore ? exercise.aliases[0] : exercise.name;
      rows.push(
        [
          `${session.date} 07:00:00`,
          `"Day ${session.programDayId ?? ""}"`,
          `${session.durationMin}m`,
          `"${name}"`,
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
