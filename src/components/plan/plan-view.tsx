"use client";

import Link from "next/link";
import { GettingStarted } from "@/components/onboarding/getting-started";
import { PageHeader } from "@/components/shell/page-header";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { DayTitle, TermsHelp, TierLabel } from "@/components/ui/terms";
import { Tag } from "@/components/ui/text";
import { describeRule, formatScheme, ruleTitle } from "@/lib/domain/describe";
import { formatLongDate } from "@/lib/format";
import { clearProgram, useActiveProgram } from "@/lib/program/store";
import { useProgress } from "@/lib/train/store";
import type { ExerciseSlot, Program } from "@/lib/domain/types";
import { rulesFor } from "@/lib/engine/engine";
import { cn } from "@/lib/cn";
import { GRID_CELL, WorkoutGrid } from "@/components/ui/workout-grid";

/**
 * The scheme as the rules run it: a rep-range rule shows its range ("4×4–6"),
 * matching what Train prescribes, rather than the reps as written.
 */
function planScheme(program: Program, slot: ExerciseSlot) {
  const progression = rulesFor(program, slot.tier).progression;
  if (progression?.kind === "double-progression") return `${slot.scheme.sets}×${progression.repRange.min}–${progression.repRange.max}`;
  return formatScheme(slot.scheme);
}

/** The active program: the sample's GZCLP, or one the lifter imported and approved. */
export function PlanView() {
  const state = useActiveProgram();
  const progress = useProgress(state.status === "ready" ? state.active : null);
  if (state.status === "loading") return <PageHeader trail="Plan" title="Loading your program…" />;

  const { program, exercises } = state.active;
  const imported = state.active.kind === "imported" ? state.active.stored : null;
  const confirmed = program.rules.filter((r) => r.status === "confirmed").length;
  const nameOf = (id: string) => exercises.get(id)?.name ?? id;
  const adjusted = new Set(progress.status === "ready" ? (progress.value.adjustments ?? []).map((a) => a.dayId) : []);

  return (
    <>
      <PageHeader
        trail="Plan"
        title={program.name}
        meta={[
          imported ? `Imported ${formatLongDate(imported.approvedAt.slice(0, 10))}` : "Sample program",
          `${program.days.length} workouts in rotation`,
          `${confirmed} rules confirmed`,
        ].join(" · ")}
        actions={
          <>
            {imported ? (
              <Button variant="secondary" onClick={() => clearProgram()}>
                Use the sample program
              </Button>
            ) : null}
            <Link href="/plan/adapt" className={buttonClasses({ variant: "secondary" })}>
              Bend the week
            </Link>
            <Link href="/plan/import" className={buttonClasses({ variant: "secondary" })}>
              Import a program
            </Link>
            <Link href="/train" className={buttonClasses({ variant: "primary" })}>
              Today’s session
            </Link>
          </>
        }
      />

      <GettingStarted />

      <Card>
        <CardHeader title="Workouts" meta={`${program.days.length} · done in order, not on set days`} />
        <WorkoutGrid count={program.days.length} max={4}>
          {program.days.map((day, i) => (
            <li key={day.id} className={cn(GRID_CELL, "enter-fade flex flex-col gap-4 px-5 py-4")} style={{ "--i": i } as React.CSSProperties}>
              <span className="flex items-center justify-between gap-2">
                <h3 className="m-0 text-md font-semibold">
                  <DayTitle program={program} day={day} />
                </h3>
                {adjusted.has(day.id) ? <Tag>Adjusted next time</Tag> : null}
              </span>
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {day.slots.map((slot) => (
                  <li key={`${slot.tier}-${slot.exerciseId}`} className="flex flex-col gap-1">
                    <TierLabel tier={slot.tier} />
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-base font-medium">{nameOf(slot.exerciseId)}</span>
                      <span className="font-mono text-sm text-fg-secondary">{planScheme(program, slot)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </WorkoutGrid>
        <div className="border-t border-border px-5 py-3">
          <TermsHelp program={program} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Progression rules" meta="Code runs these exactly" />
        <ul className="m-0 flex list-none flex-col gap-3 p-4">
          {program.rules.map((rule) => (
            <li key={rule.id} className="flex flex-col gap-1.5 rounded-md border border-border px-4 py-3">
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <TierLabel tier={rule.tier} plural />
                <span className="text-base font-semibold">{ruleTitle(rule)}</span>
              </span>
              <span className="font-mono text-base text-fg-secondary">{describeRule(rule)}</span>
              {imported && rule.source ? (
                <span className="font-display text-md text-muted italic">“{imported.sourceText.slice(rule.source.start, rule.source.end)}”</span>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
