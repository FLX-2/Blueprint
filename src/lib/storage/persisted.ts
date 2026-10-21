"use client";

import { useSyncExternalStore } from "react";
import { idbDelete, idbGet, idbPut, readFlag, writeFlag } from "./idb";

export type Loaded<T> = { status: "loading" } | { status: "ready"; value: T };

/**
 * A value saved on this device (IndexedDB), readable from React. The server
 * and the first render see `initial()`; if a saved value exists (a
 * localStorage flag says so), the hook reports "loading" until it's read, so
 * stale defaults never flash.
 */
export function persisted<T>(key: string, initial: () => T) {
  const flag = `bp-${key}`;
  let value: Loaded<T> | null = null;
  let fallback: Loaded<T> | null = null;
  let loading: Promise<void> | null = null;
  const listeners = new Set<() => void>();

  const initialState = () => (fallback ??= { status: "ready", value: initial() });
  const emit = (next: Loaded<T>) => {
    value = next;
    listeners.forEach((l) => l());
  };

  function getSnapshot(): Loaded<T> {
    if (value) return value;
    if (!readFlag(flag)) return (value = initialState());
    loading ??= idbGet<T>(key)
      .then((stored) => emit(stored === undefined ? initialState() : { status: "ready", value: stored }))
      .catch(() => emit(initialState()));
    return { status: "loading" };
  }
  const loadingSnapshot: Loaded<T> = { status: "loading" };
  const stableSnapshot = () => {
    const s = getSnapshot();
    return s.status === "loading" ? loadingSnapshot : s;
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  return {
    useValue(): Loaded<T> {
      return useSyncExternalStore(subscribe, stableSnapshot, initialState);
    },
    /** The current value outside React (after it has loaded). */
    peek(): T | null {
      const s = stableSnapshot();
      return s.status === "ready" ? s.value : null;
    },
    async set(next: T) {
      emit({ status: "ready", value: next });
      loading = Promise.resolve();
      await idbPut(key, next);
      writeFlag(flag, true);
    },
    async reset() {
      emit(initialState());
      loading = null;
      await idbDelete(key);
      writeFlag(flag, false);
    },
  };
}
