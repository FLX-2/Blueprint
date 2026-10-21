"use client";

import type { ReactNode } from "react";
import { CheckIcon } from "@/components/icons";
import { useFocusWhenLost } from "@/lib/a11y/focus";
import { cn } from "@/lib/cn";

/**
 * One layout for every multi-step flow (program import, history import):
 * a stepper you can click back through, a visible title and instruction for
 * the step, the step's content sliding in from the direction you moved, and
 * the same pinned bar with Back and the next action.
 */

export type FlowStep = { id: string; label: string };

export function FlowStepper({
  steps,
  current,
  reachable,
  onGo,
}: {
  steps: FlowStep[];
  current: number;
  /** Steps you can jump back to (usually everything before `current`). */
  reachable: (index: number) => boolean;
  onGo: (index: number) => void;
}) {
  return (
    <nav aria-label="Steps">
      <ol className="m-0 flex list-none flex-wrap items-center gap-x-2 gap-y-2 p-0">
        {steps.map((s, i) => {
          const done = i < current;
          const here = i === current;
          const go = !here && reachable(i);
          const inner = (
            <>
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border font-mono text-xs transition-colors duration-200",
                  done && "border-accent bg-accent text-accent-fg",
                  here && "border-fg bg-fg text-inverse",
                  !done && !here && "border-border-input text-muted",
                )}
                aria-hidden="true"
              >
                {done ? <CheckIcon width={13} height={13} strokeWidth={3} /> : i + 1}
              </span>
              {/* Phones show every step's number, but only the current step's name. */}
              <span className={cn("text-sm whitespace-nowrap", here ? "font-semibold text-fg" : done ? "sr-only text-fg-secondary sm:not-sr-only" : "sr-only text-muted sm:not-sr-only")}>{s.label}</span>
              <span className="sr-only">{done ? " (done)" : here ? " (current step)" : ""}</span>
            </>
          );
          return (
            <li key={s.id} className="flex items-center gap-2" aria-current={here ? "step" : undefined}>
              {i > 0 ? <span className={cn("h-px w-5 shrink-0 sm:w-10", i <= current ? "bg-accent" : "bg-border")} aria-hidden="true" /> : null}
              {go ? (
                <button type="button" onClick={() => onGo(i)} className="flex items-center gap-2 rounded-sm py-1 hover:[&>span:nth-child(2)]:text-fg">
                  {inner}
                </button>
              ) : (
                <span className="flex items-center gap-2 py-1">{inner}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** "Step 2 of 4" + title + what to do. Takes focus when the step changes (not on first load). */
export function StepHeader({ index, total, title, children }: { index: number; total: number; title: string; children?: ReactNode }) {
  const ref = useFocusWhenLost<HTMLHeadingElement>(index > 0);
  return (
    <div className="flex flex-col gap-1.5">
      <h2 ref={ref} tabIndex={-1} className="m-0 text-2xl font-semibold tracking-[-0.01em]">
        <span className="sr-only">
          Step {index + 1} of {total}:{" "}
        </span>
        {title}
      </h2>
      {children ? <p className="m-0 max-w-[720px] text-md text-fg-secondary">{children}</p> : null}
    </div>
  );
}

/** Step content, sliding in from the side you came from. */
export function StepBody({ stepKey, direction, children }: { stepKey: string; direction: "forward" | "back"; children: ReactNode }) {
  return (
    <div key={stepKey} className={cn("flex flex-col gap-6", direction === "forward" ? "step-forward" : "step-back")}>
      {children}
    </div>
  );
}

/** The pinned bar: where you stand on the left, Back and the next action on the right. */
export function StepFooter({ status, children }: { status?: ReactNode; children: ReactNode }) {
  return (
    <div data-step-footer className="sticky bottom-[calc(72px+env(safe-area-inset-bottom))] z-10 md:bottom-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface/90 px-4 py-3 shadow-popover backdrop-blur-md">
        <span aria-live="polite" className="min-w-0 text-sm text-fg-secondary">
          {status}
        </span>
        <div className="ml-auto flex flex-wrap gap-2">{children}</div>
      </div>
    </div>
  );
}
