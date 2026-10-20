import { exercises as library, HISTORY_END, sessions as sampleSessions, THREE_DAY_START } from "@/data/seed";
import type { Exercise, IsoDate, Session, Unit } from "@/lib/domain/types";

/** The training history the Review screens read: the sample athlete, or the user's import. */
export type Dataset = {
  kind: "sample" | "imported";
  label: string;
  sessions: Session[];
  /** Library plus any exercises created during import. */
  exercises: Exercise[];
  exerciseById: Map<string, Exercise>;
  /** "Today" for relative windows: the last logged session. */
  end: IsoDate;
  /** A date to mark on charts, when the data has a known story (sample only). */
  marker?: { date: IsoDate; label: string };
};

/** What gets persisted for an import (IndexedDB, in this browser only). */
export type StoredImport = {
  version: 1;
  fileName: string;
  importedAt: string;
  unit: Unit;
  sessions: Session[];
  customExercises: Exercise[];
};

function withIndex(exercises: Exercise[]) {
  return new Map(exercises.map((e) => [e.id, e]));
}

export const sampleDataset: Dataset = {
  kind: "sample",
  label: "Sample athlete",
  sessions: sampleSessions,
  exercises: library,
  exerciseById: withIndex(library),
  end: HISTORY_END,
  marker: { date: THREE_DAY_START, label: "3-day weeks from" },
};

export function datasetFromImport(stored: StoredImport): Dataset {
  const exercises = [...library, ...stored.customExercises];
  return {
    kind: "imported",
    label: stored.fileName,
    sessions: stored.sessions,
    exercises,
    exerciseById: withIndex(exercises),
    end: stored.sessions.at(-1)?.date ?? HISTORY_END,
  };
}
