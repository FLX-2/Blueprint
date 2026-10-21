"use client";

import Link from "next/link";
import { Sparkline, WeekBars } from "@/components/charts/sparkline";
import { PageHeader } from "@/components/shell/page-header";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Tag } from "@/components/ui/text";
import { useTrainingData } from "@/lib/dataset/training";
import { formatChange, formatLb, formatShortDate } from "@/lib/format";
import { chestWeeks, liftCards } from "@/lib/review/overview";

const SUGGESTED_QUESTIONS = [
  "Why did my bench stall?",
  "Is my overhead press stalling too?",
  "How has my squat changed since June?",
];

export function ReviewOverview() {
  const state = useTrainingData();

  if (state.status === "loading") {
    return (
      <>
        <PageHeader trail="Review" title="Your training" meta="Loading your history…" />
        <Card className="h-72 animate-pulse" aria-hidden="true" />
      </>
    );
  }

  const data = state.dataset;
  const lifts = liftCards(data);
  const { weeks, markIndex } = chestWeeks(data);
  const first = data.sessions[0];

  return (
    <>
      <PageHeader
        trail="Review"
        title="Your training"
        meta={
          first
            ? `${data.label} · ${data.sessions.length} sessions · ${formatShortDate(first.date)}, ${first.date.slice(0, 4)} – ${formatShortDate(data.end)}`
            : data.label
        }
        actions={
          <Link href="/review/data" className={buttonClasses({ variant: "secondary" })}>
            {data.kind === "sample" ? "Import your history" : "Manage data"}
          </Link>
        }
      />

      <Card>
        <CardHeader title="Main lifts · estimated 1RM" meta="Last 4 weeks vs. 8 weeks earlier" />
        <ul className="m-0 grid list-none grid-cols-1 gap-px bg-border p-0 sm:grid-cols-2 xl:grid-cols-4">
          {lifts.map((lift) => (
            <li key={lift.id} className="bg-surface">
              <Link href={`/review/lifts/${lift.id}`} className="flex flex-col gap-2 px-5 py-4 text-fg no-underline hover:bg-surface-raised">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-md font-semibold">{lift.name}</span>
                  {lift.status ? <Tag>{lift.status}</Tag> : null}
                </span>
                <span className="flex items-baseline gap-3">
                  <span className="num text-2xl font-medium">{lift.now !== null ? formatLb(lift.now) : "—"}</span>
                  {lift.change !== null ? (
                    <span className={`num text-sm ${lift.status ? "text-muted" : "text-accent"}`}>{formatChange(lift.change)}</span>
                  ) : null}
                </span>
                <Sparkline values={lift.recent} label={`${lift.name} best estimated 1RM per week, last 20 weeks`} />
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <div className="flex flex-wrap items-start gap-6">
        {weeks.length > 1 ? (
          <Card className="min-w-0 flex-[1.4_1_480px]">
            <CardHeader title="Weekly chest sets" meta={`Last ${weeks.length} weeks`} />
            <div className="flex flex-col gap-2 px-5 py-4">
              <WeekBars
                values={weeks.map(([, n]) => n)}
                markFrom={markIndex}
                label={`Weekly chest sets over the last ${weeks.length} weeks`}
              />
              <div className="flex justify-between font-mono text-xs text-muted">
                <span>{formatShortDate(weeks[0][0])}</span>
                {data.marker && markIndex !== undefined ? (
                  <span>
                    {data.marker.label} {formatShortDate(data.marker.date)}
                  </span>
                ) : null}
                <span>{formatShortDate(weeks.at(-1)![0])}</span>
              </div>
            </div>
          </Card>
        ) : null}

        <Card className="min-w-0 flex-[1_1_320px]">
          <CardHeader title="Ask about it" meta="Answers come with the sets behind them" />
          <ul className="m-0 flex list-none flex-col gap-2 p-4">
            {SUGGESTED_QUESTIONS.map((q) => (
              <li key={q}>
                <Link
                  href={`/review/ask?q=${encodeURIComponent(q)}`}
                  className="flex min-h-11 items-center rounded-sm border border-border bg-surface px-3.5 text-base font-medium text-fg no-underline hover:bg-surface-raised"
                >
                  {q}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
