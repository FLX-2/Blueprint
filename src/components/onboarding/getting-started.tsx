"use client";

import Link from "next/link";
import { CheckIcon, CloseIcon } from "@/components/icons";
import { Eyebrow } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import { dismissChecklist, useOnboardingFlags } from "@/lib/onboarding";
import { useActiveProgram } from "@/lib/program/store";
import { logStore } from "@/lib/train/store";

/** A short checklist that points a new lifter at each part of the app. Gone once done or closed. */
export function GettingStarted() {
  const flags = useOnboardingFlags();
  const program = useActiveProgram();
  const log = logStore.useValue();
  if (flags.dismissed || program.status !== "ready" || log.status !== "ready") return null;

  const imported = program.active.kind === "imported";
  const steps = [
    { label: imported ? "Your program is in" : "Look around the sample plan", href: "/plan", done: true },
    { label: "Import your own program", hint: "Paste it; you check what the AI read", href: "/plan/import", done: imported },
    { label: "Log a session in gym mode", hint: "Works offline, one tap per set", href: "/train", done: log.value.length > 0 },
    { label: "Ask your history a question", hint: "Every number links to its evidence", href: "/review/ask", done: flags.asked },
  ];
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  const next = steps.findIndex((s) => !s.done);

  return (
    <section aria-labelledby="getting-started" className="enter-up rounded-lg border border-border bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <h2 id="getting-started" className="m-0 flex items-center gap-3">
          <Eyebrow>Getting started</Eyebrow>
          <span className="font-mono text-xs text-muted">
            {done} of {steps.length}
          </span>
        </h2>
        <button
          type="button"
          onClick={dismissChecklist}
          aria-label="Hide getting started"
          className="flex size-8 items-center justify-center rounded-sm text-muted transition-colors duration-150 hover:bg-surface-raised hover:text-fg"
        >
          <CloseIcon width={16} height={16} />
        </button>
      </div>
      <div className="h-0.5 bg-surface-raised" aria-hidden="true">
        <div className="h-full bg-accent transition-[width] duration-500 ease-standard" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ol className="m-0 grid list-none gap-px bg-border p-0 sm:grid-cols-2 xl:grid-cols-4">
        {steps.map((s, i) => (
          <li key={s.href} className="bg-surface">
            <Link
              href={s.href}
              aria-current={i === next ? "step" : undefined}
              className={cn(
                "group flex h-full items-start gap-3 px-5 py-4 no-underline transition-colors duration-150 hover:bg-surface-raised",
                s.done ? "text-muted" : "text-fg",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                  s.done ? "border-accent bg-accent text-accent-fg" : i === next ? "border-fg" : "border-border-input",
                )}
                aria-hidden="true"
              >
                {s.done ? <CheckIcon width={12} height={12} strokeWidth={3} /> : null}
              </span>
              <span className="flex flex-col gap-0.5">
                <span className={cn("text-base font-medium", s.done && "line-through decoration-1")}>
                  {s.label}
                  <span className="sr-only">{s.done ? " (done)" : ""}</span>
                </span>
                {"hint" in s && s.hint && !s.done ? <span className="text-sm text-fg-secondary">{s.hint}</span> : null}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
