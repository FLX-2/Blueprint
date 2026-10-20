"use client";

import { useSyncExternalStore } from "react";
import { exercises as library, program as sampleProgram } from "@/data/seed";
import type { Exercise, Program } from "@/lib/domain/types";
import type { ProgramState } from "@/lib/engine/engine";
import { idbDelete, idbGet, idbPut, readFlag, writeFlag } from "@/lib/storage/idb";

/** An approved program, with the starting state the lifter set. Lives in this browser only. */
export type StoredProgram = {
  version: 1;
  program: Program;
  customExercises: Exercise[];
  state: ProgramState;
  sourceText: string;
  approvedAt: string;
};

export type ActiveProgram =
  | { kind: "sample"; program: Program; exercises: Map<string, Exercise> }
  | { kind: "imported"; program: Program; exercises: Map<string, Exercise>; stored: StoredProgram };

export type ProgramStoreState = { status: "loading" } | { status: "ready"; active: ActiveProgram };

const KEY = "program";
const FLAG = "bp-program";

const libraryById = new Map(library.map((e) => [e.id, e]));
const SAMPLE: ProgramStoreState = { status: "ready", active: { kind: "sample", program: sampleProgram, exercises: libraryById } };
const LOADING: ProgramStoreState = { status: "loading" };

function fromStored(stored: StoredProgram): ProgramStoreState {
  const exercises = new Map([...libraryById, ...stored.customExercises.map((e) => [e.id, e] as const)]);
  return { status: "ready", active: { kind: "imported", program: stored.program, exercises, stored } };
}

let state: ProgramStoreState | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit(next: ProgramStoreState) {
  state = next;
  listeners.forEach((l) => l());
}

function getSnapshot(): ProgramStoreState {
  if (state) return state;
  if (!readFlag(FLAG)) return (state = SAMPLE);
  loading ??= idbGet<StoredProgram>(KEY)
    .then((stored) => emit(stored ? fromStored(stored) : SAMPLE))
    .catch(() => emit(SAMPLE));
  return LOADING;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The active program: the sample's GZCLP on the server, an approved import in the browser if there is one. */
export function useActiveProgram(): ProgramStoreState {
  return useSyncExternalStore(subscribe, getSnapshot, () => SAMPLE);
}

export async function saveProgram(stored: StoredProgram) {
  await idbPut(KEY, stored);
  writeFlag(FLAG, true);
  loading = Promise.resolve();
  emit(fromStored(stored));
}

export async function clearProgram() {
  await idbDelete(KEY);
  writeFlag(FLAG, false);
  loading = null;
  emit(SAMPLE);
}
