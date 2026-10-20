import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Eyebrow, Tag } from "@/components/ui/text";
import { getExercise, program } from "@/data/seed";
import { describeRule, formatScheme, ruleTitle } from "@/lib/domain/describe";

export const metadata: Metadata = { title: "Plan" };

export default function PlanPage() {
  const confirmed = program.rules.filter((r) => r.status === "confirmed").length;

  return (
    <>
      <PageHeader
        trail="Plan"
        title={program.name}
        meta={`${program.days.length} days · rotate ${program.days.map((d) => d.name).join(" ")} · ${confirmed} rules confirmed`}
        actions={
          <>
            <Link href="/plan/import" className={buttonClasses({ variant: "secondary" })}>
              Import a program
            </Link>
            <Link href="/train" className={buttonClasses({ variant: "primary" })}>
              Today’s session
            </Link>
          </>
        }
      />

      <Card>
        <CardHeader title="Days" meta={`${program.days.length} · repeats in order`} />
        <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 xl:grid-cols-4">
          {program.days.map((day) => (
            <div key={day.id} className="flex flex-col gap-2.5 bg-surface px-5 py-4">
              <Eyebrow>Day {day.name}</Eyebrow>
              {day.slots.map((slot) => (
                <div key={`${slot.tier}-${slot.exerciseId}`} className="grid grid-cols-[28px_1fr_auto] items-baseline gap-2">
                  <span className="font-mono text-xs text-muted">{slot.tier}</span>
                  <span className="text-base font-medium">{getExercise(slot.exerciseId).name}</span>
                  <span className="font-mono text-sm text-fg-secondary">{formatScheme(slot.scheme)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Progression rules" meta="Code runs these exactly" />
        <ul className="m-0 flex list-none flex-col gap-3 p-4">
          {program.rules.map((rule) => (
            <li key={rule.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-md border border-border px-4 py-3">
              <span className="text-base font-semibold">
                <span className="font-mono font-medium text-muted">{rule.tier} · </span>
                {ruleTitle(rule)}
              </span>
              <Tag tone="confirmed">Confirmed</Tag>
              <span className="col-span-2 font-mono text-base text-fg-secondary">{describeRule(rule)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
