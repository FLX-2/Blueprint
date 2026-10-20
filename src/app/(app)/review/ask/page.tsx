import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";
import { PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Ask" };

export default function AskPage() {
  return (
    <>
      <PageHeader trail="Review / Ask" title="Ask your history" />
      <ComingSoon phase="Phase 1 · F4" title="Exact answers, with the sets behind them" back={{ href: "/review", label: "Back to Review" }}>
        Ask in plain language. The AI decides which analysis to run, code calculates every number, and each claim links to
        the sets that support it.
      </ComingSoon>
    </>
  );
}
