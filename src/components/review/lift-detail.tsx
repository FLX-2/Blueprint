"use client";

import Link from "next/link";
import { Sparkline } from "@/components/charts/sparkline";
import { PageHeader } from "@/components/shell/page-header";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { liftTrend, weeklyBest } from "@/lib/calc/strength";
import { useDataset } from "@/lib/dataset/store";
import { formatLb, formatLongDate } from "@/lib/format";

export function LiftDetail({ id }: { id: string }) {
  const state = useDataset();
  if (state.status === "loading") {
    return <PageHeader trail="Review / Lifts" title="Loading lift…" />;
  }

  const data = state.dataset;
  const exercise = data.exerciseById.get(id);
  const trend = liftTrend(data.sessions, id);

  if (!exercise || trend.length === 0) {
    return (
      <>
        <PageHeader trail="Review / Lifts" title={exercise?.name ?? "Unknown lift"} meta={data.label} />
        <Card className="flex max-w-[640px] flex-col items-start gap-4 p-6">
          <p className="m-0 text-md text-fg-secondary">There are no sets of this exercise in {data.kind === "sample" ? "the sample data" : "your imported history"}.</p>
          <Link href="/review" className={buttonClasses({ variant: "secondary" })}>
            Back to Review
          </Link>
        </Card>
      </>
    );
  }

  const best = trend.reduce((a, b) => (b.e1rm > a.e1rm ? b : a), trend[0]);
  const recent = trend.slice(-12).reverse();
  const weighted = exercise.equipment !== "bodyweight" && best.e1rm > 0;

  return (
    <>
      <PageHeader
        trail="Review / Lifts"
        title={exercise.name}
        meta={
          weighted
            ? `${trend.length} sessions · best est. 1RM ${formatLb(best.e1rm)} on ${formatLongDate(best.date)}`
            : `${trend.length} sessions`
        }
      />

      {weighted ? (
        <Card>
          <CardHeader title="Estimated 1RM" meta="Best per week · Epley" />
          <div className="px-5 py-4">
            <Sparkline
              values={weeklyBest(trend).map((w) => w.e1rm)}
              label={`${exercise.name} best estimated 1RM per week`}
              className="h-40"
            />
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Recent top sets" meta={`Last ${recent.length} sessions`} />
        <div className="overflow-x-auto px-5 py-3">
          <table className="num w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th scope="col" className="border-b border-border pb-2 font-medium">Date</th>
                <th scope="col" className="border-b border-border pb-2 text-right font-medium">Top set</th>
                {weighted ? <th scope="col" className="border-b border-border pb-2 text-right font-medium">Est. 1RM</th> : null}
              </tr>
            </thead>
            <tbody>
              {recent.map((p, i) => (
                <tr key={`${p.date}-${i}`}>
                  <td className="border-b border-border py-2.5">{formatLongDate(p.date)}</td>
                  <td className="border-b border-border py-2.5 text-right">
                    {p.set.weight > 0 ? `${p.set.weight} × ${p.set.reps}` : `BW × ${p.set.reps}`}
                  </td>
                  {weighted ? <td className="border-b border-border py-2.5 text-right text-fg-secondary">{Math.round(p.e1rm)}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
