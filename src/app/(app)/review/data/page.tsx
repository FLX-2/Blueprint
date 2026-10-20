import type { Metadata } from "next";
import { ImportFlow } from "@/components/import/import-flow";

export const metadata: Metadata = { title: "Import history" };

export default function DataPage() {
  return <ImportFlow />;
}
