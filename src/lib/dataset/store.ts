"use client";

import { useSyncExternalStore } from "react";
import { idbDelete, idbGet, idbPut, readFlag, writeFlag } from "@/lib/storage/idb";
import { datasetFromImport, sampleDataset, type Dataset, type StoredImport } from "./dataset";

/**
 * Imported history lives in this browser only (IndexedDB): the file is
 * parsed client-side and never uploaded. A localStorage flag says an import
 * exists, so the first render knows to wait for it instead of flashing the
 * sample data.
 */

const KEY = "import";
const FLAG = "bp-dataset";

export type DatasetState = { status: "loading" } | { status: "ready"; dataset: Dataset };

const SAMPLE_STATE: DatasetState = { status: "ready", dataset: sampleDataset };
const LOADING_STATE: DatasetState = { status: "loading" };

let state: DatasetState | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit(next: DatasetState) {
  state = next;
  listeners.forEach((l) => l());
}

function load() {
  loading ??= idbGet<StoredImport>(KEY)
    .then((stored) => emit(stored ? { status: "ready", dataset: datasetFromImport(stored) } : SAMPLE_STATE))
    .catch(() => emit(SAMPLE_STATE));
}

function getSnapshot(): DatasetState {
  if (state) return state;
  if (!readFlag(FLAG)) return (state = SAMPLE_STATE);
  load();
  return LOADING_STATE;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The active dataset. Renders the sample on the server; switches to an import on the client. */
export function useDataset(): DatasetState {
  return useSyncExternalStore(subscribe, getSnapshot, () => SAMPLE_STATE);
}

export async function saveImport(stored: StoredImport) {
  await idbPut(KEY, stored);
  writeFlag(FLAG, true);
  loading = Promise.resolve();
  emit({ status: "ready", dataset: datasetFromImport(stored) });
}

export async function clearImport() {
  await idbDelete(KEY);
  writeFlag(FLAG, false);
  loading = null;
  emit(SAMPLE_STATE);
}
