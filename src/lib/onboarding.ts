"use client";

import { useSyncExternalStore } from "react";

/**
 * First run. A cookie (the server reads it to send "/" to the welcome screen
 * or the app) and a couple of localStorage flags for the Getting started
 * checklist. Nothing here is training data.
 */

export const STARTED_COOKIE = "bp-started";
const DISMISSED = "bp-checklist-dismissed";
const ASKED = "bp-asked";

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Picked a starting point (or imported something): "/" opens the app from now on. */
export function markStarted() {
  try {
    document.cookie = `${STARTED_COOKIE}=1; path=/; max-age=31536000; samesite=lax`;
  } catch {
    // Cookies blocked: "/" keeps showing the welcome screen, which is harmless.
  }
}

/** Settings → "Show the welcome screen again". */
export function resetOnboarding() {
  try {
    document.cookie = `${STARTED_COOKIE}=; path=/; max-age=0; samesite=lax`;
    localStorage.removeItem(DISMISSED);
    localStorage.removeItem(ASKED);
  } catch {
    // Storage blocked: nothing to reset.
  }
  emit();
}

function read(key: string) {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function write(key: string) {
  try {
    localStorage.setItem(key, "1");
  } catch {
    // Storage blocked: applies for this page view only.
  }
  emit();
}

export const dismissChecklist = () => write(DISMISSED);
/** Ask answered a question (a checklist step). */
export const markAsked = () => {
  if (!read(ASKED)) write(ASKED);
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

type Flags = { dismissed: boolean; asked: boolean; hydrated: boolean };
const SERVER: Flags = { dismissed: true, asked: false, hydrated: false };
let cached: Flags | null = null;
function snapshot(): Flags {
  const next = { dismissed: read(DISMISSED), asked: read(ASKED), hydrated: true };
  if (!cached || cached.dismissed !== next.dismissed || cached.asked !== next.asked) cached = next;
  return cached;
}

/** Checklist flags. On the server (and during hydration) the checklist is hidden, so it never flashes. */
export function useOnboardingFlags(): Flags {
  return useSyncExternalStore(subscribe, snapshot, () => SERVER);
}
