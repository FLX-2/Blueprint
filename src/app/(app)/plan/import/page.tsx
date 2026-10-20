import type { Metadata } from "next";
import { ImportProgram } from "@/components/program/import-program";

export const metadata: Metadata = { title: "Import a program" };

export default function ImportPage() {
  return <ImportProgram />;
}
