"use client";

import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Tag } from "@/components/ui/text";
import { athlete } from "@/data/seed";
import { applyChanges, quoteConstraint } from "@/lib/adapt/changes";
import { cn } from "@/lib/cn";
import { prescribe } from "@/lib/engine/engine";
import { platesFor } from "@/lib/engine/plates";
import { formatLoad, formatShortDate } from "@/lib/format";
import { useActiveProgram } from "@/lib/program/store";
import { activeSessionStore, adjustmentFor, progressStore, useProgress } from "@/lib/train/store";

/** Today's targets from the rule engine, for whichever program is active, and a way into gym mode. */
export function TrainView() {
  const program = useActiveProgram();
  const active = program.status === "ready" ? program.active : null;
  const progress = useProgress(active);
  const session = activeSessionStore.useValue();

  if (!active || progress.status !== "ready" || session.status !== "ready") {
    return <PageHeader trail="Train" title="Loading your program…" />;
  }

  const { state, dayIndex, lastEvents, lastSummary } = progress.value;
  const day = active.program.days[dayIndex % active.program.days.length];
  const open = session.value && session.value.programId === active.program.id ? session.value : null;
  const logged = open ? open.slots.reduce((n, s) => n + s.sets.filter((x) => x.done).length, 0) : 0;
  const total = open ? open.slots.reduce((n, s) => n + s.sets.length, 0) : 0;
  const adjustment = adjustmentFor(progress.value, day.id);
  const upcomingAdjusted = progress.value.adjustments?.length ?? 0;
  const items = applyChanges(prescribe(active.program, day, state, athlete), adjustment?.changes ?? []).map((p) => {
    const exercise = active.exercises.get(p.slot.exerciseId)!;
    const weight = p.sets?.at(-1)?.weight ?? null;
    const original = p.change ? active.exercises.get(day.slots.find((s) => `${s.tier}:${s.exerciseId}` === p.change!.slotKey)?.exerciseId ?? "") : undefined;
    return {
      ...p,
      exercise,
      original,
      weight,
      plates: weight && exercise.equipment === "barbell" ? platesFor(weight, athlete.barWeight) : null,
      because: p.change ? undefined : lastEvents[p.key],
    };
  });

  return (
    <>
      <PageHeader
        trail="Train"
        title={
          <>
            Day {open ? active.program.days.find((d) => d.id === open.dayId)?.name : day.name},{" "}
            <span className="font-normal italic">{open ? "in progress" : "next up"}</span>
          </>
        }
        meta={`${active.program.name} · ${open ? `${logged} of ${total} sets logged` : `${day.slots.length} exercises`}`}
        actions={
          <>
            {lastSummary && !open ? (
              <Link href="/train/summary" className={buttonClasses({ variant: "secondary" })}>
                Last session
              </Link>
            ) : null}
            {!open ? (
              <Link href="/plan/adapt" className={buttonClasses({ variant: "secondary" })}>
                Something changed?
              </Link>
            ) : null}
            <Link href="/train/session" className={buttonClasses({ variant: "primary", size: "lg" })}>
              {open ? "Resume session" : "Start session"}
            </Link>
          </>
        }
      />

      {upcomingAdjusted ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <span className="text-base text-fg-secondary">
            <span className="font-medium text-fg">
              {upcomingAdjusted} coming {upcomingAdjusted === 1 ? "session is" : "sessions are"} adjusted
            </span>{" "}
            for {quoteConstraint(progress.value.adjustments![0].constraint)}. Each change is used once, then the plan goes back to normal.
          </span>
          <span className="flex gap-2">
            <Link href="/plan/adapt" className={buttonClasses({ variant: "secondary", size: "sm" })}>
              Change
            </Link>
            <button
              type="button"
              onClick={() => void progressStore(active).set({ ...progress.value, adjustments: [] })}
              className={buttonClasses({ variant: "secondary", size: "sm" })}
            >
              Undo
            </button>
          </span>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Today’s targets" meta={adjustment ? "Rule engine targets, adjusted for this session" : "Calculated by the rule engine"} />
        <ul className="m-0 list-none p-0">
          {items.map((item) => (
            <li
              key={item.key}
              className={cn(
                "grid grid-cols-[36px_minmax(0,1fr)] gap-x-3 gap-y-1.5 border-b border-border px-5 py-4 last:border-b-0 sm:grid-cols-[36px_minmax(0,1fr)_auto]",
                item.change?.kind === "skip" && "text-muted",
              )}
            >
              <span className="font-mono text-sm text-muted">{item.slot.tier}</span>
              <span className={cn("text-md font-semibold", item.change?.kind === "skip" && "line-through")}>
                {item.exercise.name} <span className="font-mono text-sm font-medium text-fg-secondary">{item.scheme}</span>{" "}
                {item.change ? <Tag>{item.change.kind === "swap" ? "Swapped" : item.change.kind === "reduce" ? "Fewer sets" : "Skipped"}</Tag> : null}
              </span>
              <span className="col-start-2 row-start-2 font-mono text-xl font-medium sm:col-start-3 sm:row-start-1 sm:text-right">
                {item.change?.kind === "skip"
                  ? "—"
                  : item.weight === null
                    ? "Set a starting weight"
                    : item.weight === 0 && item.exercise.equipment !== "bodyweight"
                      ? "Pick on the day"
                      : formatLoad(item.weight, item.exercise.equipment === "bodyweight")}
              </span>
              <span className="col-start-2 text-sm text-fg-secondary sm:col-span-2">
                {item.change ? (
                  <>
                    {item.change.kind === "swap" && item.original ? <span className="text-muted">Instead of {item.original.name} · </span> : null}
                    {item.change.reason}
                    {item.change.kind === "swap" && item.change.estimatedFrom ? (
                      <span className="text-muted"> · Weight estimated from your {item.change.estimatedFrom}</span>
                    ) : null}
                  </>
                ) : item.because ? (
                  <>
                    <span className="font-mono text-muted">{formatShortDate(item.because.date)} · </span>
                    {item.because.message}
                  </>
                ) : (
                  "Your starting weight."
                )}
                {item.note ? <span className="text-muted"> · {item.note}</span> : null}
              </span>
              {item.plates && item.plates.perSide.length ? (
                <span className="col-start-2 font-mono text-xs text-muted sm:col-span-2">
                  Per side: {item.plates.perSide.join(" · ")}
                  {item.plates.rounded ? ` (closest: ${item.plates.total} lb)` : ""}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
