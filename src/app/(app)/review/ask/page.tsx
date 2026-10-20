import type { Metadata } from "next";
import { Suspense } from "react";
import { AskView } from "@/components/ask/ask-view";
import { PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Ask" };

// AskView reads ?q= from the URL, which suspends during prerendering.
export default function AskPage() {
  return (
    <Suspense fallback={<PageHeader trail="Review / Ask" title="Ask your history" />}>
      <AskView />
    </Suspense>
  );
}
