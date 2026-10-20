"use client";

import { useSyncExternalStore } from "react";
import { datasetFromImport, sampleDataset, type Dataset, type StoredImport } from "./dataset";

/**
 * Imported history lives in this browser only (IndexedDB): the file is
 * parsed client-side and never uploaded. A localStorage flag says an import
 * exists, so the first render knows to wait for it instead of flashing the
 * sample data.
 */

const DB_NAME = "blueprint";
const STORE = "kv";
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

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

function hasFlag() {
  try {
    return localStorage.getItem(FLAG) === "imported";
  } catch {
    return false;
  }
}

function setFlag(on: boolean) {
  try {
    if (on) localStorage.setItem(FLAG, "imported");
    else localStorage.removeItem(FLAG);
  } catch {
    // Storage blocked: the import still works for this page view.
  }
}

function load() {
  loading ??= run<StoredImport | undefined>("readonly", (s) => s.get(KEY))
    .then((stored) => emit(stored ? { status: "ready", dataset: datasetFromImport(stored) } : SAMPLE_STATE))
    .catch(() => emit(SAMPLE_STATE));
}

function getSnapshot(): DatasetState {
  if (state) return state;
  if (!hasFlag()) return (state = SAMPLE_STATE);
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
  await run("readwrite", (s) => s.put(stored, KEY));
  setFlag(true);
  loading = Promise.resolve();
  emit({ status: "ready", dataset: datasetFromImport(stored) });
}

export async function clearImport() {
  await run("readwrite", (s) => s.delete(KEY));
  setFlag(false);
  loading = null;
  emit(SAMPLE_STATE);
}
