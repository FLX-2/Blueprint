"use client";

import Link from "next/link";
import { athlete } from "@/data/seed";
import { applyChanges } from "@/lib/adapt/changes";
import { cn } from "@/lib/cn";
import { TIER_NAMES, dayLabel } from "@/lib/domain/describe";
import type { Tier } from "@/lib/domain/types";
import { prescribe, type EventKind } from "@/lib/engine/engine";
import { formatLoad, formatLongDate } from "@/lib/format";
import { useActiveProgram } from "@/lib/program/store";
import { adjustmentFor, nextDayOf, useProgress } from "@/lib/train/store";

const KIND_LABEL: Record<EventKind, string> = {
  progressed: "Up",
  held: "Same",
  "stage-down": "New stage",
  reset: "Reset",
  skipped: "Skipped",
  cycle: "New cycle",
};

/** What happened in the last session, and what the rule engine decided because of it. */
export function SessionSummary() {
  const program = useActiveProgram();
  const active = program.status === "ready" ? program.active : null;
  const progress = useProgress(active);

  if (!active || progress.status !== "ready") {
    return (
      <main className="gym flex min-h-dvh items-center justify-center font-mono text-sm text-gym-muted">
        <p role="status">Loading…</p>
      </main>
    );
  }

  const summary = progress.value.lastSummary;
  if (!summary) {
    return (
      <main className="gym flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="m-0 font-display text-3xl font-normal">No session logged yet.</h1>
        <p className="m-0 text-base text-gym-muted">Your summary shows up here after you finish one in gym mode.</p>
        <span className="flex gap-6">
          <Link href="/train/session" className="font-medium text-gym-text">
            Start a session
          </Link>
          <Link href="/train" className="font-medium text-gym-muted">
            Back to Train
          </Link>
        </span>
      </main>
    );
  }

  const nameOf = (id: string) => active.exercises.get(id)?.name ?? id;
  const exerciseOf = (key: string) => key.slice(key.indexOf(":") + 1);
  const next = nextDayOf(active.program, progress.value);
  const summaryDay = active.program.days.find((d) => d.name === summary.dayName);
  // Next time's targets, with any Bend the week changes for that day.
  const nextTargets = applyChanges(prescribe(active.program, next, progress.value.state, athlete), adjustmentFor(progress.value, next.id)?.changes ?? []).filter(
    (p) => p.change?.kind !== "skip",
  );

  return (
    <div className="gym min-h-dvh">
      <main className="mx-auto flex w-full max-w-[560px] flex-col gap-8 px-6 pt-10 pb-12">
        <div className="enter-up flex flex-col gap-2">
          <p className="m-0 font-mono text-xs tracking-[0.06em] text-gym-muted">
            {(summaryDay ? dayLabel(active.program, summaryDay) : `Day ${summary.dayName}`).toUpperCase()} · {formatLongDate(summary.date).toUpperCase()}
          </p>
          <h1 className="m-0 font-display text-5xl font-medium tracking-[-0.02em]">
            Session <span className="font-normal italic">done.</span>
          </h1>
        </div>

        <dl className="m-0 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-gym-track bg-gym-track">
          {[
            ["Time", `${summary.durationMin} min`],
            ["Sets", `${summary.setsDone}/${summary.setsPlanned}`],
            ["Volume", `${Math.round(summary.volume).toLocaleString("en-US")} lb`],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-col gap-1 bg-gym-bg px-4 py-3">
              <dt className="font-mono text-[11px] tracking-[0.08em] text-gym-muted uppercase">{label}</dt>
              <dd className="num m-0 text-xl font-medium">{value}</dd>
            </div>
          ))}
        </dl>

        {summary.bests.length ? (
          <section aria-label="New bests" className="flex flex-col gap-3">
            <h2 className="m-0 font-mono text-xs tracking-[0.08em] text-gym-muted uppercase">New bests</h2>
            {summary.bests.map((b) => (
              <p key={b.exerciseId} className="m-0 text-md">
                <span className="font-semibold">{nameOf(b.exerciseId)}</span>: est. 1RM <span className="num">{Math.round(b.e1rm)} lb</span>
                <span className="text-gym-muted">
                  {" "}
                  from {b.set.weight} × {b.set.reps}
                  {b.previous ? ` (was ${Math.round(b.previous)})` : " (first time logged)"}
                </span>
              </p>
            ))}
          </section>
        ) : null}

        <section aria-label="What the rules decided" className="flex flex-col gap-3">
          <h2 className="m-0 font-mono text-xs tracking-[0.08em] text-gym-muted uppercase">What the rules decided</h2>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {summary.events.map((e, i) => (
              <li key={e.key} className="enter-up flex flex-col gap-1 border-b border-gym-track pb-3" style={{ "--i": i + 2 } as React.CSSProperties}>
                <span className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold">
                    <span className="block font-mono text-[11px] font-normal tracking-[0.08em] text-gym-muted uppercase">
                      {TIER_NAMES[e.key.split(":")[0] as Tier]?.one ?? e.key.split(":")[0]}
                    </span>
                    {nameOf(exerciseOf(e.key))}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 font-mono text-xs",
                      e.kind === "progressed" || e.kind === "cycle" ? "bg-accent text-accent-fg" : "border border-gym-track text-gym-muted",
                    )}
                  >
                    {e.swapped ? "Swapped" : KIND_LABEL[e.kind]}
                  </span>
                </span>
                <span className="text-base text-gym-muted">{e.message}</span>
                {e.needsRetest ? <span className="text-sm text-gym-text">Retest your 5RM before the next heavy session.</span> : null}
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Next up" className="flex flex-col gap-3 rounded-xl border border-gym-track p-4">
          <h2 className="m-0 font-mono text-xs tracking-[0.08em] text-gym-muted uppercase">Next up · {dayLabel(active.program, next)}</h2>
          {nextTargets.map((p) => {
            const top = p.sets?.at(-1);
            const exercise = active.exercises.get(p.slot.exerciseId);
            return (
              <p key={p.key} className="m-0 flex justify-between gap-3 text-base">
                <span>
                  {exercise?.name} <span className="font-mono text-sm text-gym-muted">{p.scheme}</span>
                  {p.change ? <span className="font-mono text-xs text-gym-muted"> adjusted</span> : null}
                </span>
                <span className="num">
                  {top && (top.weight > 0 || exercise?.equipment === "bodyweight") ? formatLoad(top.weight, exercise?.equipment === "bodyweight") : "—"}
                </span>
              </p>
            );
          })}
        </section>

        <Link href="/train" className="flex h-14 items-center justify-center rounded-xl bg-accent text-md font-semibold text-accent-fg no-underline">
          Done
        </Link>
      </main>
    </div>
  );
}
