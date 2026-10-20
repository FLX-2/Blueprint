import type { Metadata } from "next";
import Link from "next/link";
import { Sparkline, WeekBars } from "@/components/charts/sparkline";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Tag } from "@/components/ui/text";
import { HISTORY_END, THREE_DAY_START, exerciseById, getExercise, sessions } from "@/data/seed";
import { bestBetween, liftTrend, weeklyBest, weeklySets } from "@/lib/calc/strength";
import { formatChange, formatLb, formatShortDate } from "@/lib/format";

export const metadata: Metadata = { title: "Review" };

const MAIN_LIFTS = ["back-squat", "bench-press", "deadlift", "overhead-press"];
const DAY_MS = 86_400_000;
const daysBefore = (date: string, days: number) =>
  new Date(new Date(`${date}T00:00:00Z`).getTime() - days * DAY_MS).toISOString().slice(0, 10);

// A lift counts as stalled when its best e1RM in the last 4 weeks is within 2%
// of the 4 weeks ending 8 weeks ago. Deterministic, so it's code, not the AI.
const STALL_THRESHOLD = 0.02;

const SUGGESTED_QUESTIONS = [
  "Why did my bench stall?",
  "Is my overhead press stalling too?",
  "How has my squat changed since June?",
];

export default function ReviewPage() {
  const end = HISTORY_END;
  const lifts = MAIN_LIFTS.map((id) => {
    const trend = liftTrend(sessions, id);
    const now = bestBetween(trend, daysBefore(end, 28), end);
    const then = bestBetween(trend, daysBefore(end, 84), daysBefore(end, 56));
    const change = now !== null && then !== null ? now / then - 1 : null;
    const recent = weeklyBest(trend.filter((p) => p.date >= daysBefore(end, 140))).map((w) => w.e1rm);
    const status =
      change === null ? null : change <= -STALL_THRESHOLD ? "Down 8 wks" : change < STALL_THRESHOLD ? "Flat 8 wks" : null;
    return { id, name: getExercise(id).name, now, change, recent, status };
  });

  const chest = [...weeklySets(sessions, exerciseById, "chest").entries()].slice(-20);
  const markFrom = chest.findIndex(([week]) => week >= THREE_DAY_START);

  return (
    <>
      <PageHeader
        trail="Review"
        title="Your training"
        meta={`${sessions.length} sessions · ${formatShortDate(sessions[0].date)}, ${sessions[0].date.slice(0, 4)} – ${formatShortDate(end)}`}
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
        <Card className="min-w-0 flex-[1.4_1_480px]">
          <CardHeader title="Weekly chest sets" meta="Last 20 weeks" />
          <div className="flex flex-col gap-2 px-5 py-4">
            <WeekBars
              values={chest.map(([, n]) => n)}
              markFrom={markFrom >= 0 ? markFrom : undefined}
              label="Weekly chest sets held around 14, then dropped to about 8 in August"
            />
            <div className="flex justify-between font-mono text-xs text-muted">
              <span>{formatShortDate(chest[0][0])}</span>
              <span>3-day weeks from {formatShortDate(THREE_DAY_START)}</span>
              <span>{formatShortDate(chest.at(-1)![0])}</span>
            </div>
          </div>
        </Card>

        <Card className="min-w-0 flex-[1_1_320px]">
          <CardHeader title="Ask about it" meta="Answers arrive in Phase 1" />
          <ul className="m-0 flex list-none flex-col gap-2 p-4">
            {SUGGESTED_QUESTIONS.map((q) => (
              <li key={q}>
                <Link
                  href="/review/ask"
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
