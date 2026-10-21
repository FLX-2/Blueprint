"use client";

import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { athlete } from "@/data/seed";
import { prescribe } from "@/lib/engine/engine";
import { platesFor } from "@/lib/engine/plates";
import { formatLoad, formatShortDate } from "@/lib/format";
import { useActiveProgram } from "@/lib/program/store";
import { activeSessionStore, useProgress } from "@/lib/train/store";

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
  const items = prescribe(active.program, day, state, athlete).map((p) => {
    const exercise = active.exercises.get(p.slot.exerciseId)!;
    const weight = p.sets?.at(-1)?.weight ?? null;
    return {
      ...p,
      exercise,
      weight,
      plates: weight !== null && exercise.equipment === "barbell" ? platesFor(weight, athlete.barWeight) : null,
      because: lastEvents[p.key],
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
            <Link href="/train/session" className={buttonClasses({ variant: "primary", size: "lg" })}>
              {open ? "Resume session" : "Start session"}
            </Link>
          </>
        }
      />

      <Card>
        <CardHeader title="Today’s targets" meta="Calculated by the rule engine" />
        <ul className="m-0 list-none p-0">
          {items.map((item) => (
            <li
              key={item.key}
              className="grid grid-cols-[36px_minmax(0,1fr)] gap-x-3 gap-y-1.5 border-b border-border px-5 py-4 last:border-b-0 sm:grid-cols-[36px_minmax(0,1fr)_auto]"
            >
              <span className="font-mono text-sm text-muted">{item.slot.tier}</span>
              <span className="text-md font-semibold">
                {item.exercise.name} <span className="font-mono text-sm font-medium text-fg-secondary">{item.scheme}</span>
              </span>
              <span className="col-start-2 row-start-2 font-mono text-xl font-medium sm:col-start-3 sm:row-start-1 sm:text-right">
                {item.weight !== null ? formatLoad(item.weight, item.exercise.equipment === "bodyweight") : "Set a starting weight"}
              </span>
              <span className="col-start-2 text-sm text-fg-secondary sm:col-span-2">
                {item.because ? (
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
