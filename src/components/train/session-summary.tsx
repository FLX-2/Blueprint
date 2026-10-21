"use client";

import Link from "next/link";
import { athlete } from "@/data/seed";
import { cn } from "@/lib/cn";
import { prescribe, type EventKind } from "@/lib/engine/engine";
import { formatLoad, formatLongDate } from "@/lib/format";
import { useActiveProgram } from "@/lib/program/store";
import { useProgress } from "@/lib/train/store";

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
    return <div className="gym flex min-h-dvh items-center justify-center font-mono text-sm text-gym-muted">Loading…</div>;
  }

  const summary = progress.value.lastSummary;
  if (!summary) {
    return (
      <div className="gym flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="m-0 font-display text-3xl">No session logged yet.</p>
        <Link href="/train/session" className="font-medium text-gym-text">
          Start one
        </Link>
      </div>
    );
  }

  const nameOf = (id: string) => active.exercises.get(id)?.name ?? id;
  const exerciseOf = (key: string) => key.slice(key.indexOf(":") + 1);
  const next = active.program.days[progress.value.dayIndex % active.program.days.length];
  const nextTargets = prescribe(active.program, next, progress.value.state, athlete);

  return (
    <div className="gym min-h-dvh">
      <main className="mx-auto flex w-full max-w-[560px] flex-col gap-8 px-6 pt-10 pb-12">
        <div className="flex flex-col gap-2">
          <p className="m-0 font-mono text-xs tracking-[0.06em] text-gym-muted">
            DAY {summary.dayName} · {formatLongDate(summary.date).toUpperCase()}
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
            {summary.events.map((e) => (
              <li key={e.key} className="flex flex-col gap-1 border-b border-gym-track pb-3">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold">
                    <span className="font-mono text-xs font-normal text-gym-muted">{e.key.split(":")[0]} </span>
                    {nameOf(exerciseOf(e.key))}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 font-mono text-xs",
                      e.kind === "progressed" || e.kind === "cycle" ? "bg-accent text-accent-fg" : "border border-gym-track text-gym-muted",
                    )}
                  >
                    {KIND_LABEL[e.kind]}
                  </span>
                </span>
                <span className="text-base text-gym-muted">{e.message}</span>
                {e.needsRetest ? <span className="text-sm text-gym-text">Retest your 5RM before the next heavy session.</span> : null}
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Next up" className="flex flex-col gap-3 rounded-xl border border-gym-track p-4">
          <h2 className="m-0 font-mono text-xs tracking-[0.08em] text-gym-muted uppercase">Next up · Day {next.name}</h2>
          {nextTargets.map((p) => {
            const top = p.sets?.at(-1);
            const exercise = active.exercises.get(p.slot.exerciseId);
            return (
              <p key={p.key} className="m-0 flex justify-between gap-3 text-base">
                <span>
                  {exercise?.name} <span className="font-mono text-sm text-gym-muted">{p.scheme}</span>
                </span>
                <span className="num">{top ? formatLoad(top.weight, exercise?.equipment === "bodyweight") : "—"}</span>
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
