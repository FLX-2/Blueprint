import type { Metadata } from "next";
import { Suspense } from "react";
import { LiftDetail } from "@/components/review/lift-detail";
import { PageHeader } from "@/components/shell/page-header";
import { exerciseById, exercises } from "@/data/seed";

// Every library exercise is prerendered. Exercises created during an import
// only exist in the browser, so their pages render on request and the
// client fills them in.
export function generateStaticParams() {
  return exercises.map((e) => ({ exercise: e.id }));
}

export async function generateMetadata({ params }: PageProps<"/review/lifts/[exercise]">): Promise<Metadata> {
  const { exercise } = await params;
  return { title: exerciseById.get(exercise)?.name ?? "Lift" };
}

// Reading `params` suspends, so the page shell renders immediately.
export default function LiftPage({ params }: PageProps<"/review/lifts/[exercise]">) {
  return (
    <Suspense fallback={<PageHeader trail="Review / Lifts" title="Loading lift…" />}>
      <Lift params={params} />
    </Suspense>
  );
}

async function Lift({ params }: { params: PageProps<"/review/lifts/[exercise]">["params"] }) {
  const { exercise } = await params;
  return <LiftDetail id={exercise} />;
}
