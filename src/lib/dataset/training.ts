"use client";

import { useMemo } from "react";
import type { Exercise, Session } from "@/lib/domain/types";
import { useActiveProgram } from "@/lib/program/store";
import { logStore } from "@/lib/train/store";
import type { Dataset } from "./dataset";
import { useDataset } from "./store";

export type TrainingData = { status: "loading" } | { status: "ready"; dataset: Dataset };

/** A dataset plus sessions logged in the app, in date order, with any custom exercises they use. */
export function withLogged(dataset: Dataset, logged: Session[], extra: Iterable<Exercise> = []): Dataset {
  if (!logged.length) return dataset;
  const exerciseById = new Map(dataset.exerciseById);
  for (const e of extra) if (!exerciseById.has(e.id)) exerciseById.set(e.id, e);
  const sessions = [...dataset.sessions, ...logged].sort((a, b) => a.date.localeCompare(b.date));
  const last = sessions.at(-1)!.date;
  return {
    ...dataset,
    sessions,
    exercises: [...exerciseById.values()],
    exerciseById,
    end: last > dataset.end ? last : dataset.end,
    label: `${dataset.label} + ${logged.length} logged`,
  };
}

/** Everything Review and Ask analyze: the imported (or sample) history plus sessions logged in gym mode. */
export function useTrainingData(): TrainingData {
  const dataset = useDataset();
  const log = logStore.useValue();
  const program = useActiveProgram();
  const ready = dataset.status === "ready" && log.status === "ready" && program.status === "ready";

  return useMemo<TrainingData>(() => {
    if (!ready) return { status: "loading" };
    return { status: "ready", dataset: withLogged(dataset.dataset, log.value, program.active.exercises.values()) };
  }, [ready, dataset, log, program]);
}
