"use client";

import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { athlete } from "@/data/seed";
import { prescribe } from "@/lib/engine/engine";
import { platesFor } from "@/lib/engine/plates";
import { todaysSession } from "@/lib/engine/today";
import { formatLoad, formatShortDate } from "@/lib/format";
import { useActiveProgram } from "@/lib/program/store";

/**
 * Today's targets from the rule engine. For the sample program they come
 * from the athlete's log; for an approved import, from the starting weights
 * (logging sessions against it arrives with gym mode, F2).
 */
export function TrainView() {
  const state = useActiveProgram();
  if (state.status === "loading") return <PageHeader trail="Train" title="Loading your program…" />;

  const active = state.active;
  const imported = active.kind === "imported";
  const { day, items } = imported
    ? (() => {
        const first = active.program.days[0];
        return {
          day: first,
          items: prescribe(active.program, first, active.stored.state, athlete).map((p) => {
            const exercise = active.exercises.get(p.slot.exerciseId)!;
            const weight = p.sets?.at(-1)?.weight ?? null;
            return {
              ...p,
              exercise,
              weight,
              plates: weight !== null && exercise.equipment === "barbell" ? platesFor(weight, athlete.barWeight) : null,
              because: undefined,
            };
          }),
        };
      })()
    : todaysSession();

  return (
    <>
      <PageHeader
        trail="Train"
        title={
          <>
            Day {day.name}, <span className="font-normal italic">{imported ? "first up" : "next up"}</span>
          </>
        }
        meta={`${active.program.name} · ${day.slots.length} exercises`}
        actions={
          imported ? (
            <span className="text-sm text-muted">Logging arrives with gym mode (F2)</span>
          ) : (
            <Link href="/train/session/demo" className={buttonClasses({ variant: "primary", size: "lg" })}>
              Start session
            </Link>
          )
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
              {item.because ? (
                <span className="col-start-2 text-sm text-fg-secondary sm:col-span-2">
                  <span className="font-mono text-muted">{formatShortDate(item.because.date)} · </span>
                  {item.because.message}
                  {item.note ? <span className="text-muted"> · {item.note}</span> : null}
                </span>
              ) : imported ? (
                <span className="col-start-2 text-sm text-fg-secondary sm:col-span-2">Your starting weight.</span>
              ) : null}
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
