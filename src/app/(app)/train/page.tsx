import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { todaysSession } from "@/lib/engine/today";
import { formatShortDate } from "@/lib/format";

export const metadata: Metadata = { title: "Train" };

export default function TrainPage() {
  const { day, items } = todaysSession();

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
                {item.weight !== null ? `${item.weight} lb` : "Set a starting weight"}
              </span>
              {item.because ? (
                <span className="col-start-2 text-sm text-fg-secondary sm:col-span-2">
                  <span className="font-mono text-muted">{formatShortDate(item.because.date)} · </span>
                  {item.because.message}
                  {item.note ? <span className="text-muted"> · {item.note}</span> : null}
                </span>
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
