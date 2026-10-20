import type { Unit } from "@/lib/domain/types";

export type ImportFormat = "strong" | "hevy" | "generic";

/** Column indexes for the fields the import needs. */
export type ColumnMap = {
  date: number;
  exercise: number;
  weight: number;
  reps: number;
  workout?: number;
  setOrder?: number;
  setType?: number;
};

export type DetectedFormat = {
  format: ImportFormat;
  /** Complete for Strong and Hevy; a best guess (possibly partial) for generic files. */
  map: Partial<ColumnMap>;
  /** Known from the header (e.g. Hevy's weight_kg), else null and the user picks. */
  unit: Unit | null;
};

export const REQUIRED_COLUMNS = ["date", "exercise", "weight", "reps"] as const;

const norm = (h: string) => h.trim().toLowerCase();

function indexOf(header: string[], ...names: string[]) {
  const lower = header.map(norm);
  for (const name of names) {
    const i = lower.indexOf(name);
    if (i !== -1) return i;
  }
  return undefined;
}

function firstMatching(header: string[], pattern: RegExp, taken: Set<number>) {
  const i = header.findIndex((h, idx) => !taken.has(idx) && pattern.test(norm(h)));
  return i === -1 ? undefined : i;
}

export function detectFormat(header: string[]): DetectedFormat {
  const has = (name: string) => header.some((h) => norm(h) === name);

  if (has("exercise name") && has("set order")) {
    return {
      format: "strong",
      map: {
        date: indexOf(header, "date"),
        workout: indexOf(header, "workout name"),
        exercise: indexOf(header, "exercise name"),
        setOrder: indexOf(header, "set order"),
        weight: indexOf(header, "weight"),
        reps: indexOf(header, "reps"),
      },
      unit: null,
    };
  }

  if (has("exercise_title") && has("set_index")) {
    const kg = indexOf(header, "weight_kg");
    const lbs = indexOf(header, "weight_lbs");
    return {
      format: "hevy",
      map: {
        date: indexOf(header, "start_time"),
        workout: indexOf(header, "title"),
        exercise: indexOf(header, "exercise_title"),
        setOrder: indexOf(header, "set_index"),
        setType: indexOf(header, "set_type"),
        weight: lbs ?? kg,
        reps: indexOf(header, "reps"),
      },
      unit: lbs !== undefined ? "lb" : kg !== undefined ? "kg" : null,
    };
  }

  return { format: "generic", ...guessMapping(header) };
}

/** Best guess for an unknown export; the user confirms or fixes it. */
export function guessMapping(header: string[]): Pick<DetectedFormat, "map" | "unit"> {
  const taken = new Set<number>();
  const take = (pattern: RegExp) => {
    const i = firstMatching(header, pattern, taken);
    if (i !== undefined) taken.add(i);
    return i;
  };
  // Order matters: claim the specific columns before the loose ones.
  const exercise = take(/exercise|movement|lift/);
  const reps = take(/^reps?$|repetition/);
  const weight = take(/weight|load|^kg$|^lbs?$/);
  const date = take(/date|^time$|start|day/);
  const setOrder = take(/^set|set ?(order|index|number|#)/);
  const workout = take(/workout|session|title|routine/);
  const weightHeader = weight !== undefined ? norm(header[weight]) : "";
  const unit = /kg/.test(weightHeader) ? "kg" : /lb/.test(weightHeader) ? "lb" : null;
  return { map: { date, exercise, weight, reps, setOrder, workout }, unit };
}

export function isComplete(map: Partial<ColumnMap>): map is ColumnMap {
  return REQUIRED_COLUMNS.every((key) => map[key] !== undefined);
}
