"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { ExtractReply } from "@/app/api/extract-program/route";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/text";
import { athlete } from "@/data/seed";
import { exerciseById, exercises } from "@/data/seed/exercises";
import { FlowStepper, StepBody, StepFooter, StepHeader } from "@/components/ui/flow";
import { restoreFocus, scrollBehavior } from "@/lib/a11y/focus";
import { useTrainingData } from "@/lib/dataset/training";
import type { Exercise } from "@/lib/domain/types";
import type { SlotKey } from "@/lib/engine/engine";
import type { MatchResponse } from "@/lib/import/ai-match-schema";
import { guessEquipment } from "@/lib/import/decisions";
import { AUTO_CONFIRM } from "@/lib/import/match";
import { draftFrom, draftIssues, programFrom, type ProgramDraft } from "@/lib/program/convert";
import { EXAMPLE_EXTRACTION, EXAMPLE_PROGRAM_TEXT } from "@/lib/program/example";
import { initialState, startInputs } from "@/lib/program/start";
import { clearProgram, saveProgram, useActiveProgram } from "@/lib/program/store";
import { ReviewStep, type CheckItem, type Selection } from "./review-step";
import { PreviewStep, WeightsStep, missingWeights } from "./start-steps";
import { LIVE_AI_OFF, useLiveAi } from "@/components/ai-status";
import { cn } from "@/lib/cn";

type Step = "paste" | "review" | "weights" | "preview";
const STEPS: Array<{ id: Step; label: string }> = [
  { id: "paste", label: "Paste" },
  { id: "review", label: "Check" },
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
  const dataset = useTrainingData();
  const active = useActiveProgram();
  const [step, setStepRaw] = useState<Step>("paste");
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [furthest, setFurthest] = useState(0);
  const [toCheck, setToCheck] = useState<CheckItem[]>([]);
  const [text, setText] = useState("");
  const [reading, setReading] = useState(false);
  const readRef = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState<string | null>(null);
  // True when "error" is the public demo's "live AI is off" note rather than a failure.
  const [offline, setOffline] = useState(false);
  const live = useLiveAi();
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

  function setStep(next: Step) {
    const from = STEPS.findIndex((s) => s.id === step);
    const to = STEPS.findIndex((s) => s.id === next);
    setDirection(to >= from ? "forward" : "back");
    setFurthest((f) => Math.max(f, to));
    setStepRaw(next);
    window.scrollTo({ top: 0, behavior: scrollBehavior() });
  }

  function open(next: ProgramDraft, isScripted: boolean) {
    setDraft(next);
    setScripted(isScripted);
    setSelected(null);
    // Numbered in the order the reading came back; numbers stay put as items are resolved.
    setToCheck(draftIssues(next).blocking);
    setFurthest(1);
    setStep("review");
  }

  async function read() {
    setError(null);
    setOffline(false);
    if (!live) {
      // Public demo: the example gets its scripted reading; anything else gets a plain note.
      if (text.trim() === EXAMPLE_PROGRAM_TEXT.trim()) open(draftFrom(EXAMPLE_EXTRACTION, EXAMPLE_PROGRAM_TEXT, exercises), true);
      else {
        setOffline(true);
        setError(`${LIVE_AI_OFF} The example program shows how import works, start to finish.`);
      }
      return;
    }
    setReading(true);
    try {
      const res = await fetch("/api/extract-program", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const reply = (await res.json().catch(() => null)) as ExtractReply | { error: string } | null;
      if (!reply || "error" in reply) setError(reply?.error ?? "Reading the program failed.");
      else if (reply.status !== "ok") setError(reply.message);
      else open(await matchUnresolved(draftFrom(reply.program, text, exercises)), false);
    } finally {
      setReading(false);
      restoreFocus(readRef.current);
    }
  }

  function select(s: Selection) {
    setSelected(s);
    if (s) document.getElementById(`item-${s.id}`)?.scrollIntoView({ block: "center", behavior: scrollBehavior() });
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
  const left = draft ? draftIssues(draft).blocking.length : 0;
  const missing = missingWeights(inputs, values);
  const reachable = (i: number) => i <= furthest && (i < 2 || left === 0) && !!(i === 0 || draft);
  const goTo = (i: number) => {
    const target = STEPS[i].id;
    if (target === "weights" && current < 2) toWeights();
    else setStep(target);
  };

  return (
    <>
      <PageHeader
        trail="Plan / Import"
        title={draft && step !== "paste" ? draft.name : <>Import a <span className="font-normal italic">program</span></>}
        meta={draft && step !== "paste" ? `From pasted text · ${draft.days.length} workouts · ${draft.rules.length} rules read` : "From a post, a PDF or a spreadsheet"}
      />
      <FlowStepper steps={STEPS} current={current} reachable={reachable} onGo={goTo} />

      {scripted && step !== "paste" ? (
        <p className="m-0 rounded-md border border-border bg-surface px-4 py-3 text-base text-fg-secondary">
          <span className="font-semibold text-fg">Scripted example.</span> The AI’s reading of this text is scripted to show how import works. Finding
          each quote in the source, checking every rule, matching exercises and calculating weights all ran for real.
        </p>
      ) : null}

      <StepBody stepKey={step} direction={direction}>
        {step === "paste" ? (
          <>
            <StepHeader index={0} total={STEPS.length} title="Paste your program">
              Copy it from wherever it lives: a forum post, a PDF, a spreadsheet. The AI reads it, and nothing runs until you’ve checked what it read.
            </StepHeader>
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
                  rows={9}
                  placeholder="Paste the program: workouts, exercises, sets and reps, and how to progress…"
                  className="min-h-56 resize-y rounded-md border border-border-input bg-bg p-4 font-display text-lg leading-[1.6] text-fg placeholder:text-muted"
                />
              </label>
              {!text ? (
                <span className="text-sm text-muted">
                  No program handy?{" "}
                  <button type="button" onClick={() => setText(EXAMPLE_PROGRAM_TEXT)} className="font-medium text-link underline-offset-4 hover:underline">
                    Use an example
                  </button>{" "}
                  (GZCLP, as posted on a forum).
                </span>
              ) : null}
            </Card>
            {error ? (
              <Card className={cn("flex flex-col gap-3 p-5", !offline && "border-danger")}>
                <p role={offline ? "status" : "alert"} className="m-0 text-md">
                  {error}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant={offline ? "primary" : "secondary"}
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
          <>
            <StepHeader index={1} total={STEPS.length} title="Check what the AI read">
              Amber, numbered items are the ones the AI wasn’t sure about. Everything else was read clearly and is ready. Select anything to see where it
              came from in your text.
            </StepHeader>
            <ReviewStep
              draft={draft}
              onChange={setDraft}
              selected={selected}
              onSelect={select}
              library={LIBRARY_SORTED}
              libraryById={allExercises}
              toCheck={toCheck}
            />
          </>
        ) : null}

        {step === "weights" && program ? (
          <>
            <StepHeader index={2} total={STEPS.length} title="Set your starting weights">
              The rules take it from here, so these only need to be close. Suggestions are about 90% of what your log shows you can do, so week 1 builds
              momentum. Change any of them.
            </StepHeader>
            <WeightsStep inputs={inputs} values={values} onChange={setValues} exercises={allExercises} dataLabel={data?.label ?? "your log"} />
          </>
        ) : null}

        {step === "preview" && program ? (
          <>
            <StepHeader index={3} total={STEPS.length} title="Preview your first rotation">
              This is what the rule engine will prescribe. After each session it applies your {program.rules.length} confirmed rules to set the next one.
            </StepHeader>
            <PreviewStep program={program} state={initialState(program, numbers)} exercises={allExercises} athlete={athlete} />
          </>
        ) : null}
      </StepBody>

      {step === "paste" ? (
        <StepFooter status={reading ? "Reading your program…" : live ? "The text goes to the AI to read." : "Public demo: the example shows how import works."}>
          <Button ref={readRef} variant="primary" onClick={read} disabled={reading || text.trim().length < 20}>
            {reading ? "Reading…" : "Read program"}
          </Button>
        </StepFooter>
      ) : null}
      {step === "review" ? (
        <StepFooter status={left ? `${left} ${left === 1 ? "item still needs" : "items still need"} your check` : "Everything is checked."}>
          <Button variant="secondary" onClick={() => setStep("paste")}>
            Back
          </Button>
          <Button variant="primary" onClick={toWeights} disabled={left > 0}>
            Continue to starting weights
          </Button>
        </StepFooter>
      ) : null}
      {step === "weights" ? (
        <StepFooter status={missing ? `${missing} still empty` : "All set."}>
          <Button variant="secondary" onClick={() => setStep("review")}>
            Back
          </Button>
          <Button variant="primary" onClick={() => setStep("preview")} disabled={missing > 0}>
            Preview first rotation
          </Button>
        </StepFooter>
      ) : null}
      {step === "preview" ? (
        <StepFooter status="Approving makes this your program in Plan and Train, in this browser.">
          <Button variant="secondary" onClick={() => setStep("weights")} disabled={saving}>
            Back
          </Button>
          <Button variant="primary" onClick={approve} disabled={saving}>
            {saving ? "Saving…" : "Approve program"}
          </Button>
        </StepFooter>
      ) : null}
    </>
  );
}
