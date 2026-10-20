import type { Metadata } from "next";
import { ReviewOverview } from "@/components/review/review-overview";

export const metadata: Metadata = { title: "Review" };

// Renders the sample athlete on the server; in the browser it switches to an
// imported history if there is one (imports never leave the browser).
export default function ReviewPage() {
  return <ReviewOverview />;
}
