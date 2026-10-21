import type { Metadata } from "next";
import { FreshOnVisit } from "@/components/fresh-on-visit";
import { ImportProgram } from "@/components/program/import-program";

export const metadata: Metadata = { title: "Import a program" };

export default function ImportPage() {
  return (
    <FreshOnVisit>
      <ImportProgram />
    </FreshOnVisit>
  );
}
