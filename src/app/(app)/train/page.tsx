import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { getExercise, program, sessions } from "@/data/seed";
import { formatScheme, lastTimeFor, nextDay } from "@/lib/domain/describe";
import { formatSets, formatShortDate } from "@/lib/format";

export const metadata: Metadata = { title: "Train" };

export default function TrainPage() {
  const day = nextDay(program, sessions);

  return (
    <>
      <PageHeader
        trail="Train"
        title={
          <>
            Day {day.name}, <span className="font-normal italic">next up</span>
          </>
        }
        meta={`${day.slots.length} exercises · about 60 min`}
        actions={
          <Link href="/train/session/demo" className={buttonClasses({ variant: "primary", size: "lg" })}>
            Start session
          </Link>
        }
      />

      <Card>
        <CardHeader title="Exercises" meta="Targets come from the rule engine in Phase 2" />
        <ul className="m-0 list-none p-0">
          {day.slots.map((slot) => {
            const last = lastTimeFor(sessions, slot.exerciseId, day.id);
            return (
              <li
                key={`${slot.tier}-${slot.exerciseId}`}
                className="grid grid-cols-[36px_minmax(0,1fr)] gap-x-3 gap-y-1 border-b border-border px-5 py-4 last:border-b-0 sm:grid-cols-[36px_minmax(0,1fr)_auto]"
              >
                <span className="font-mono text-sm text-muted">{slot.tier}</span>
                <span className="text-md font-semibold">
                  {getExercise(slot.exerciseId).name}{" "}
                  <span className="font-mono text-sm font-medium text-fg-secondary">{formatScheme(slot.scheme)}</span>
                </span>
                {last ? (
                  <span className="col-start-2 font-mono text-sm text-muted sm:col-start-3 sm:text-right">
                    Last time ({formatShortDate(last.date)}): {formatSets(last.sets)}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}
