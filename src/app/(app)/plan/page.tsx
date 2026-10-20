import type { Metadata } from "next";
import { PlanView } from "@/components/plan/plan-view";

export const metadata: Metadata = { title: "Plan" };

// Renders the sample program on the server; in the browser it switches to an
// approved import if there is one (programs never leave the browser).
export default function PlanPage() {
  return <PlanView />;
}
