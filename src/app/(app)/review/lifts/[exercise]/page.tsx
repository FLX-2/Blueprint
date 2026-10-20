import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Sparkline } from "@/components/charts/sparkline";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { exerciseById, exercises, sessions } from "@/data/seed";
import { liftTrend, weeklyBest } from "@/lib/calc/strength";
import { formatLb, formatLongDate } from "@/lib/format";

export function generateStaticParams() {
  return exercises.filter((e) => liftTrend(sessions, e.id).length > 0).map((e) => ({ exercise: e.id }));
}

export async function generateMetadata({ params }: PageProps<"/review/lifts/[exercise]">): Promise<Metadata> {
  const { exercise } = await params;
  return { title: exerciseById.get(exercise)?.name ?? "Lift" };
}

// Reading `params` suspends, so the page shell renders immediately and the
// lift streams in behind the boundary.
export default function LiftPage({ params }: PageProps<"/review/lifts/[exercise]">) {
  return (
    <Suspense fallback={<PageHeader trail="Review / Lifts" title="Loading lift…" />}>
      <Lift params={params} />
    </Suspense>
  );
}

async function Lift({ params }: { params: PageProps<"/review/lifts/[exercise]">["params"] }) {
  const { exercise: id } = await params;
  const exercise = exerciseById.get(id);
  if (!exercise) notFound();

  const trend = liftTrend(sessions, id);
  const best = trend.reduce((a, b) => (b.e1rm > a.e1rm ? b : a), trend[0]);
  const recent = trend.slice(-12).reverse();
  const weighted = exercise.equipment !== "bodyweight";

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
              {recent.map((p) => (
                <tr key={p.date}>
                  <td className="border-b border-border py-2.5">{formatLongDate(p.date)}</td>
                  <td className="border-b border-border py-2.5 text-right">
                    {weighted ? `${p.set.weight} × ${p.set.reps}` : `BW × ${p.set.reps}`}
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
