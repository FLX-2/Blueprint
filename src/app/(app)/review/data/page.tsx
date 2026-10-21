import type { Metadata } from "next";
import { FreshOnVisit } from "@/components/fresh-on-visit";
import { ImportFlow } from "@/components/import/import-flow";

export const metadata: Metadata = { title: "Import history" };

export default function DataPage() {
  return (
    <FreshOnVisit>
      <ImportFlow />
    </FreshOnVisit>
  );
}
