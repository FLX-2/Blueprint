import type { Metadata } from "next";
import { SessionSummary } from "@/components/train/session-summary";

export const metadata: Metadata = { title: "Session summary" };

export default function SummaryPage() {
  return <SessionSummary />;
}
