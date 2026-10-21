"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import { DEFAULT_THEME, THEMES, THEME_STORAGE_KEY, isTheme, type Theme } from "@/lib/theme";
import { cn } from "@/lib/cn";

const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

function applyTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage blocked: the choice still applies for this page view.
  }
  // Switch every color at once: no cross-fading borders and fields mid-switch.
  const root = document.documentElement;
  root.classList.add("theme-switching");
  root.setAttribute("data-theme", theme);
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("theme-switching")));
  listeners.forEach((notify) => notify());
}

const LABELS: Record<Theme, string> = { dark: "Dark", light: "Light", system: "System" };

export function ThemeSwitcher() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => DEFAULT_THEME);

  // React resets <html> attributes on the dev Strict Mode remount; re-apply before paint.
  useLayoutEffect(() => {
    document.documentElement.setAttribute("data-theme", readTheme());
  }, []);

  return (
    <div role="group" aria-label="Theme" className="inline-flex gap-1 rounded-md bg-surface-raised p-1">
      {THEMES.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={theme === option}
          onClick={() => applyTheme(option)}
          className={cn(
            "h-9 rounded-sm px-4 text-base font-medium transition-colors duration-150 focus-visible:outline-offset-0",
            theme === option
              ? "border border-border bg-surface text-fg"
              : "text-muted hover:text-fg",
          )}
        >
          {LABELS[option]}
        </button>
      ))}
    </div>
  );
}
