import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";
import { PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Import a program" };

export default function ImportPage() {
  return (
    <>
      <PageHeader trail="Plan / Import" title="Import a program" />
      <ComingSoon phase="Phase 2 · F1" title="Paste a program, review what the AI read" back={{ href: "/plan", label: "Back to Plan" }}>
        Paste text, a link or a spreadsheet. The AI extracts days, exercises and progression rules, flags anything it isn’t
        sure about, and nothing runs until you confirm it.
      </ComingSoon>
    </>
  );
}
