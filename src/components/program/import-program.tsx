"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ExtractReply } from "@/app/api/extract-program/route";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/text";
import { athlete } from "@/data/seed";
import { exerciseById, exercises } from "@/data/seed/exercises";
import { cn } from "@/lib/cn";
import { useDataset } from "@/lib/dataset/store";
import type { Exercise } from "@/lib/domain/types";
import type { SlotKey } from "@/lib/engine/engine";
import type { MatchResponse } from "@/lib/import/ai-match-schema";
import { guessEquipment } from "@/lib/import/decisions";
import { AUTO_CONFIRM } from "@/lib/import/match";
import { draftFrom, programFrom, type ProgramDraft } from "@/lib/program/convert";
import { EXAMPLE_EXTRACTION, EXAMPLE_PROGRAM_TEXT } from "@/lib/program/example";
import { initialState, startInputs } from "@/lib/program/start";
import { clearProgram, saveProgram, useActiveProgram } from "@/lib/program/store";
import { ReviewStep, type Selection } from "./review-step";
import { PreviewStep, WeightsStep } from "./start-steps";

type Step = "paste" | "review" | "weights" | "preview";
const STEPS: Array<{ id: Step; label: string }> = [
  { id: "paste", label: "Paste" },
  { id: "review", label: "Review" },
  { id: "weights", label: "Starting weights" },
  { id: "preview", label: "Preview" },
];
const LIBRARY_SORTED = [...exercises].sort((a, b) => a.name.localeCompare(b.name));

/** Names code couldn't place go to the same AI matcher the history import uses. */
async function matchUnresolved(draft: ProgramDraft): Promise<ProgramDraft> {
  const names = [...new Set(draft.days.flatMap((d) => d.slots.filter((s) => !s.alternatives.length && s.match.method !== "exact").map((s) => s.name)))];
  if (!names.length) return draft;
  try {
    const res = await fetch("/api/match-exercises", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ names }) });
    const data = (await res.json()) as MatchResponse;
    if (data.status !== "ok") return draft;
    const byName = new Map(data.matches.filter((m) => m.exerciseId && exerciseById.has(m.exerciseId)).map((m) => [m.name, m]));
    return {
      ...draft,
      days: draft.days.map((d) => ({
        ...d,
        slots: d.slots.map((s) => {
          const m = byName.get(s.name);
          if (!m || s.match.method === "exact") return s;
          return {
            ...s,
            match: { name: s.name, exerciseId: m.exerciseId, confidence: m.confidence, method: "ai" as const, reason: m.reason },
            exerciseId: m.exerciseId,
            confirmed: m.confidence >= AUTO_CONFIRM && s.confidence >= AUTO_CONFIRM,
          };
        }),
      })),
    };
  } catch {
    return draft;
  }
}

function customExercisesFor(draft: ProgramDraft): Exercise[] {
  const out = new Map<string, Exercise>();
  for (const slot of draft.days.flatMap((d) => d.slots)) {
    if (!slot.exerciseId || exerciseById.has(slot.exerciseId) || out.has(slot.exerciseId)) continue;
    const name = slot.name.trim().replace(/\b\w/g, (c) => c.toUpperCase());
    out.set(slot.exerciseId, { id: slot.exerciseId, name, aliases: [], pattern: "accessory", muscles: [], equipment: guessEquipment(name), body: "upper" });
  }
  return [...out.values()];
}

export function ImportProgram() {
  const router = useRouter();
  const dataset = useDataset();
  const active = useActiveProgram();
  const [step, setStep] = useState<Step>("paste");
  const [text, setText] = useState("");
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scripted, setScripted] = useState(false);
  const [draft, setDraft] = useState<ProgramDraft | null>(null);
  const [selected, setSelected] = useState<Selection>(null);
  const [values, setValues] = useState<Partial<Record<SlotKey, string>>>({});
  const [saving, setSaving] = useState(false);

  const custom = draft ? customExercisesFor(draft) : [];
  const allExercises = new Map([...exerciseById, ...custom.map((e) => [e.id, e] as const)]);
  const program = draft && (step === "weights" || step === "preview") ? programFrom(draft, "draft") : null;
  const data = dataset.status === "ready" ? dataset.dataset : null;
  const inputs = program && data ? startInputs(program, data, athlete, allExercises) : [];
  const numbers = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Number(v)])) as Partial<Record<SlotKey, number>>;

  function open(next: ProgramDraft, isScripted: boolean) {
    setDraft(next);
    setScripted(isScripted);
    setSelected(null);
    setStep("review");
  }

  async function read() {
    setReading(true);
    setError(null);
    try {
      const res = await fetch("/api/extract-program", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const reply = (await res.json().catch(() => null)) as ExtractReply | { error: string } | null;
      if (!reply || "error" in reply) setError(reply?.error ?? "Reading the program failed.");
      else if (reply.status !== "ok") setError(reply.message);
      else open(await matchUnresolved(draftFrom(reply.program, text, exercises)), false);
    } finally {
      setReading(false);
    }
  }

  function select(s: Selection) {
    setSelected(s);
    if (s) document.getElementById(`item-${s.id}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function toWeights() {
    if (!draft || !data) return;
    const p = programFrom(draft, "draft");
    const prefill: Partial<Record<SlotKey, string>> = {};
    for (const i of startInputs(p, data, athlete, allExercises)) prefill[i.key] = values[i.key]?.trim() ? values[i.key] : i.suggestion !== null ? String(i.suggestion) : "";
    setValues(prefill);
    setStep("weights");
  }

  async function approve() {
    if (!draft) return;
    setSaving(true);
    const final = programFrom(draft, `prog-${new Date().toISOString()}`);
    await saveProgram({
      version: 1,
      program: final,
      customExercises: custom,
      state: initialState(final, numbers),
      sourceText: draft.sourceText,
      approvedAt: new Date().toISOString(),
    });
    router.push("/plan");
  }

  const current = STEPS.findIndex((s) => s.id === step);
  const imported = active.status === "ready" && active.active.kind === "imported" ? active.active : null;

  return (
    <>
      <PageHeader
        trail="Plan / Import"
        title={draft && step !== "paste" ? draft.name : <>Import a <span className="font-normal italic">program</span></>}
        meta={draft && step !== "paste" ? `From pasted text · ${draft.days.length} days · ${draft.rules.length} rules read` : "Paste it from a post, a PDF or a spreadsheet"}
      />
      <ol className="m-0 flex list-none flex-wrap gap-x-6 gap-y-2 p-0 font-mono text-xs tracking-[0.06em] uppercase">
        {STEPS.map((s, i) => (
          <li key={s.id} aria-current={i === current ? "step" : undefined} className={cn(i === current ? "text-fg" : "text-muted")}>
            <span className="num">{i + 1}</span> · {s.label}
          </li>
        ))}
      </ol>

      {scripted && step !== "paste" ? (
        <p className="m-0 rounded-md border border-border bg-surface px-4 py-3 text-base text-fg-secondary">
          <span className="font-semibold text-fg">Scripted example.</span> The AI’s reading of this text is scripted to show how import works. Finding
          each quote in the source, checking every rule, matching exercises and calculating weights all ran for real.
        </p>
      ) : null}

      {step === "paste" ? (
        <>
          {imported ? (
            <Card className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
              <span className="text-base text-fg-secondary">
                You’re running <span className="font-medium text-fg">{imported.program.name}</span>. Approving a new import replaces it.
              </span>
              <Button variant="secondary" size="sm" onClick={() => clearProgram()}>
                Go back to the sample program
              </Button>
            </Card>
          ) : null}
          <Card className="flex flex-col gap-4 p-5">
            <label className="flex flex-col gap-2">
              <Eyebrow>Program text</Eyebrow>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={12}
                placeholder="Paste the program: days, exercises, sets and reps, and how to progress…"
                className="min-h-64 resize-y rounded-md border border-border bg-bg p-4 font-display text-lg leading-[1.6] text-fg placeholder:text-muted focus:border-focus focus:outline-none"
              />
            </label>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-muted">The text goes to the AI to read. Nothing runs until you’ve checked it.</span>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setText(EXAMPLE_PROGRAM_TEXT)} disabled={reading}>
                  Use an example
                </Button>
                <Button variant="primary" onClick={read} disabled={reading || text.trim().length < 20}>
                  {reading ? "Reading…" : "Read program"}
                </Button>
              </div>
            </div>
          </Card>
          {error ? (
            <Card className="flex flex-col gap-3 p-5">
              <p role="alert" className="m-0 text-md">
                {error}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setText(EXAMPLE_PROGRAM_TEXT);
                    setError(null);
                    open(draftFrom(EXAMPLE_EXTRACTION, EXAMPLE_PROGRAM_TEXT, exercises), true);
                  }}
                >
                  See a scripted example
                </Button>
                <span className="text-sm text-muted">Loads the example program with the AI’s reading scripted; everything after that runs for real.</span>
              </div>
            </Card>
          ) : null}
        </>
      ) : null}

      {step === "review" && draft ? (
        <ReviewStep
          draft={draft}
          onChange={setDraft}
          selected={selected}
          onSelect={select}
          library={LIBRARY_SORTED}
          libraryById={allExercises}
          onBack={() => setStep("paste")}
          onContinue={toWeights}
        />
      ) : null}

      {step === "weights" && program ? (
        <WeightsStep
          inputs={inputs}
          values={values}
          onChange={setValues}
          exercises={allExercises}
          dataLabel={data?.label ?? "your log"}
          onBack={() => setStep("review")}
          onContinue={() => setStep("preview")}
        />
      ) : null}

      {step === "preview" && program ? (
        <PreviewStep
          program={program}
          state={initialState(program, numbers)}
          exercises={allExercises}
          athlete={athlete}
          saving={saving}
          onBack={() => setStep("weights")}
          onApprove={approve}
        />
      ) : null}
    </>
  );
}
