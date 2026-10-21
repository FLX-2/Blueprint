import type { Metadata } from "next";
import { Suspense } from "react";
import { AdaptView } from "@/components/plan/adapt-view";
import { PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Bend the week" };

// AdaptView reads ?c= (a constraint from the Ask bar), which suspends during prerendering.
export default function AdaptPage() {
  return (
    <Suspense fallback={<PageHeader trail="Plan / Bend the week" title="Bend the week" />}>
      <AdaptView />
    </Suspense>
  );
}
