"use client";

import { athlete, exerciseById, program as sampleProgram, sessions as sampleSessions } from "@/data/seed";
import { nextDay } from "@/lib/domain/describe";
import type { IsoDate, Session } from "@/lib/domain/types";
import { stateFromHistory, type ProgramState, type RuleEvent, type SlotKey } from "@/lib/engine/engine";
import type { ActiveProgram } from "@/lib/program/store";
import { idbDelete } from "@/lib/storage/idb";
import { persisted, type Loaded } from "@/lib/storage/persisted";
import type { DayAdjustment } from "@/lib/adapt/changes";
import type { ActiveSession, SessionSummary } from "./session";

/**
 * Training progress, saved on this device so gym mode never needs the network:
 * - per program: the engine's state, which day is next, and the last summary;
 * - one log of every session logged in the app (Review and Ask read it too);
 * - the session in progress, saved after every set.
 */

export type Progress = {
  programId: string;
  state: ProgramState;
  dayIndex: number;
  lastEvents: Partial<Record<SlotKey, RuleEvent & { date: IsoDate }>>;
  lastSummary: SessionSummary | null;
  /** Temporary changes for coming sessions (Bend the week), used up as each day is trained. */
  adjustments?: DayAdjustment[];
};

/** The pending adjustment for the next time this day is trained, if any. */
export function adjustmentFor(progress: Progress, dayId: string) {
  return progress.adjustments?.find((a) => a.dayId === dayId);
}

let sampleStart: Progress | null = null;
/** Where the sample athlete stands after their 18 months of history. */
function sampleProgress(): Progress {
  if (sampleStart) return sampleStart;
  const { state, lastEvents } = stateFromHistory({ program: sampleProgram, sessions: sampleSessions, exercises: exerciseById, athlete });
  const day = nextDay(sampleProgram, sampleSessions);
  return (sampleStart = {
    programId: sampleProgram.id,
    state,
    dayIndex: sampleProgram.days.findIndex((d) => d.id === day.id),
    lastEvents,
    lastSummary: null,
  });
}

const progressStores = new Map<string, ReturnType<typeof persisted<Progress>>>();

export function progressStore(active: ActiveProgram) {
  const id = active.program.id;
  let store = progressStores.get(id);
  if (!store) {
    store = persisted<Progress>(`progress:${id}`, () =>
      active.kind === "sample"
        ? sampleProgress()
        : { programId: id, state: active.stored.state, dayIndex: 0, lastEvents: {}, lastSummary: null },
    );
    progressStores.set(id, store);
  }
  return store;
}

const noProgress = persisted<Progress | null>("progress:none", () => null);

/** The active program's progress. Always calls exactly one hook, whatever is loaded. */
export function useProgress(active: ActiveProgram | null): Loaded<Progress> {
  const store = (active ? progressStore(active) : noProgress) as typeof noProgress;
  const loaded = store.useValue();
  return loaded.status === "ready" && loaded.value ? { status: "ready", value: loaded.value } : { status: "loading" };
}

/** Every session logged in the app, oldest first. */
export const logStore = persisted<Session[]>("log", () => []);

/** The session in progress, if any. */
export const activeSessionStore = persisted<ActiveSession | null>("session", () => null);

/** Deletes every logged session, the session in progress, and all programs' progress. */
export async function resetTraining() {
  await Promise.all([logStore.reset(), activeSessionStore.reset(), ...[...progressStores.values()].map((s) => s.reset())]);
  // Progress for programs not opened this visit: clear by flag name.
  try {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith("bp-progress:"));
    await Promise.all(keys.map((k) => idbDelete(k.slice(3))));
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    // Storage blocked: nothing persisted to clear.
  }
}

/** Today in the lifter's time zone, as YYYY-MM-DD. */
export function localDate(now = new Date()): IsoDate {
  return now.toLocaleDateString("en-CA");
}
