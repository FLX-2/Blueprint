"use client";

import { useFocusWhenLost } from "@/lib/a11y/focus";

/**
 * A hidden heading for the current step of a multi-step flow. Render it with
 * key={step}: each new step remounts it, and focus moves here if the button
 * that changed the step is gone, so screen readers hear where they are.
 * The first step doesn't take focus, so loading the page doesn't move it.
 */
export function StepHeading({ index, total, label }: { index: number; total: number; label: string }) {
  const ref = useFocusWhenLost<HTMLHeadingElement>(index > 0);
  return (
    <h2 ref={ref} tabIndex={-1} className="sr-only">
      Step {index + 1} of {total}: {label}
    </h2>
  );
}
