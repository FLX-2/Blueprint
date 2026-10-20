"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { exerciseById, exercises } from "@/data/seed/exercises";
import { cn } from "@/lib/cn";
import { clearImport, saveImport, useDataset } from "@/lib/dataset/store";
import type { Unit } from "@/lib/domain/types";
import type { MatchResponse } from "@/lib/import/ai-match-schema";
import { parseCsv } from "@/lib/import/csv";
import { decisionFrom, resolveDecisions, type Decision } from "@/lib/import/decisions";
import { detectFormat, isComplete, type ColumnMap, type DetectedFormat } from "@/lib/import/formats";
import { matchNames, mergeAi, needsAi, type Suggestion } from "@/lib/import/match";
import { buildSessions, readRows, summarize } from "@/lib/import/rows";
import { ChooseFile } from "./choose-file";
import { ColumnMapper } from "./column-mapper";
import { NameCleanup, type AiState } from "./name-cleanup";
import { PreviewStep } from "./preview-step";

type Step = "choose" | "map" | "preview" | "clean";
const STEPS: Array<{ id: Step; label: string }> = [
  { id: "choose", label: "Choose file" },
  { id: "preview", label: "Check what was read" },
  { id: "clean", label: "Clean up names" },
];

const LIBRARY_SORTED = [...exercises].sort((a, b) => a.name.localeCompare(b.name));

type Loaded = { fileName: string; header: string[]; body: string[][]; detected: DetectedFormat };

function Stepper({ step }: { step: Step }) {
  const current = STEPS.findIndex((s) => s.id === (step === "map" ? "preview" : step));
  return (
    <ol className="m-0 flex list-none flex-wrap gap-x-6 gap-y-2 p-0 font-mono text-xs tracking-[0.06em] uppercase">
      {STEPS.map((s, i) => (
        <li key={s.id} aria-current={i === current ? "step" : undefined} className={cn(i === current ? "text-fg" : "text-muted")}>
          <span className="num">{i + 1}</span> · {s.label}
        </li>
      ))}
    </ol>
  );
}

export function ImportFlow() {
  const router = useRouter();
  const dataset = useDataset();
  const [step, setStep] = useState<Step>("choose");
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [map, setMap] = useState<Partial<ColumnMap>>({});
  const [unit, setUnit] = useState<Unit>("lb");
  const [fileError, setFileError] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [ai, setAi] = useState<AiState>({ status: "idle" });
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const read = loaded && isComplete(map) ? readRows(loaded.body, map, loaded.detected.unit ?? unit) : null;
  const summary = read ? summarize(read.sets) : null;

  function onLoaded(fileName: string, text: string) {
    const rows = parseCsv(text);
    if (rows.length < 2) {
      setFileError("That file doesn’t have any rows we can read. Is it a CSV export?");
      return;
    }
    const detected = detectFormat(rows[0]);
    setFileError(null);
    setLoaded({ fileName, header: rows[0], body: rows.slice(1), detected });
    setMap(detected.map);
    setUnit(detected.unit ?? "lb");
    setStep(detected.format !== "generic" && isComplete(detected.map) ? "preview" : "map");
  }

  async function startCleanup() {
    if (!summary) return;
    const counts = new Map(summary.names.map((n) => [n.name, n.sets]));
    const suggestions = matchNames(summary.names.map((n) => n.name), exercises);
    setDecisions(suggestions.map((s) => decisionFrom(s, counts.get(s.name) ?? 0)));
    setStep("clean");

    const pending = needsAi(suggestions);
    if (!pending.length) {
      setAi({ status: "idle" });
      return;
    }
    setAi({ status: "loading", names: new Set(pending) });
    try {
      const res = await fetch("/api/match-exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ names: pending.slice(0, 100) }),
      });
      const data = (await res.json()) as MatchResponse;
      if (data.status !== "ok") {
        setAi({ status: "off", message: data.message });
        return;
      }
      const fromAi: Suggestion[] = data.matches.map((m) => ({
        name: m.name,
        exerciseId: m.exerciseId,
        confidence: m.confidence,
        method: "ai",
        reason: m.reason,
        newExercise: m.newExercise ?? undefined,
      }));
      const merged = new Map(mergeAi(suggestions, fromAi, exerciseById).map((s) => [s.name, s]));
      // Only names the AI was asked about change; everything else keeps the user's choices.
      setDecisions((current) =>
        current.map((d) => (pending.includes(d.name) ? decisionFrom(merged.get(d.name) ?? d.suggestion, d.sets) : d)),
      );
      setAi({ status: "done", count: fromAi.length });
    } catch {
      setAi({ status: "off", message: "AI matching couldn’t be reached." });
    }
  }

  async function finishImport() {
    if (!loaded || !read) return;
    setImporting(true);
    setImportError(null);
    try {
      const { exerciseIdFor, customExercises } = resolveDecisions(decisions);
      await saveImport({
        version: 1,
        fileName: loaded.fileName,
        importedAt: new Date().toISOString(),
        unit: loaded.detected.unit ?? unit,
        sessions: buildSessions(read.sets, exerciseIdFor),
        customExercises,
      });
      router.push("/review");
    } catch {
      setImportError("Saving failed. Your browser may be blocking site storage (private mode?).");
      setImporting(false);
    }
  }

  function reset() {
    setStep("choose");
    setLoaded(null);
    setDecisions([]);
    setAi({ status: "idle" });
  }

  const current = dataset.status === "ready" && dataset.dataset.kind === "imported" ? dataset.dataset : null;

  return (
    <>
      <PageHeader
        trail="Review / Data"
        title={
          <>
            Import your <span className="font-normal italic">history</span>
          </>
        }
        meta={loaded ? loaded.fileName : "Strong, Hevy or any CSV export"}
      />
      <Stepper step={step} />

      {current && step === "choose" ? (
        <Card className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
          <span className="text-base text-fg-secondary">
            Review is showing <span className="font-medium text-fg">{current.label}</span> ({current.sessions.length} sessions). A new import
            replaces it.
          </span>
          <div className="flex gap-2">
            <Link href="/review" className={buttonClasses({ variant: "secondary", size: "sm" })}>
              Back to Review
            </Link>
            <Button variant="secondary" size="sm" onClick={() => clearImport()}>
              Remove import
            </Button>
          </div>
        </Card>
      ) : null}

      {step === "choose" ? <ChooseFile onLoaded={onLoaded} error={fileError} /> : null}

      {step === "map" && loaded ? (
        <ColumnMapper
          header={loaded.header}
          sample={loaded.body.slice(0, 3)}
          map={map}
          onChange={setMap}
          onBack={reset}
          onContinue={() => setStep("preview")}
        />
      ) : null}

      {step === "preview" && loaded && read && summary ? (
        <PreviewStep
          fileName={loaded.fileName}
          format={loaded.detected.format}
          summary={summary}
          skipped={read.skipped}
          unit={loaded.detected.unit ?? unit}
          unitKnown={loaded.detected.unit !== null}
          onUnit={setUnit}
          onBack={() => (loaded.detected.format === "generic" ? setStep("map") : reset())}
          onContinue={startCleanup}
        />
      ) : null}

      {step === "clean" ? (
        <>
          {importError ? (
            <p role="alert" className="m-0 rounded-md border border-danger bg-danger-wash px-4 py-3 text-base">
              {importError}
            </p>
          ) : null}
          <NameCleanup
            decisions={decisions}
            onChange={setDecisions}
            ai={ai}
            library={LIBRARY_SORTED}
            libraryById={exerciseById}
            importing={importing}
            onBack={() => setStep("preview")}
            onImport={finishImport}
          />
        </>
      ) : null}
    </>
  );
}
