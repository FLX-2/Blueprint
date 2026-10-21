"use client";

import { useEffect, useRef } from "react";

/**
 * When a step or panel replaces the control that had focus (Propose, Log set,
 * Next), the browser drops focus to <body> and keyboard and screen reader
 * users lose their place. This moves focus to the new content on mount, but
 * only if focus was lost, so it never steals it from something else.
 * Put it on a heading (with tabIndex={-1}) or the next control.
 */
export function useFocusWhenLost<T extends HTMLElement>(enabled = true) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!enabled) return;
    const active = document.activeElement;
    if (!active || active === document.body) ref.current?.focus({ preventScroll: false });
    // Only on mount: later renders mustn't pull focus back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ref;
}

/**
 * Puts focus back on a control that was disabled while it worked (Read,
 * Propose), if nothing else picked it up. Disabling a focused button drops
 * focus to <body>.
 */
export function restoreFocus(el: HTMLElement | null) {
  requestAnimationFrame(() => {
    const active = document.activeElement;
    if (!active || active === document.body) el?.focus();
  });
}

/** Smooth scrolling, unless the lifter asked for less motion. */
export function scrollBehavior(): ScrollBehavior {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}
