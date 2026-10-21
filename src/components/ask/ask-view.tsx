"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { AskReply } from "@/app/api/ask/route";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/text";
import { EXAMPLE_QUESTION, exampleModel } from "@/lib/ask/example-script";
import { emptyThread, runTurn, type Answer, type CallModel, type Step, type Thread } from "@/lib/ask/loop";
import { runTool, type ToolResult } from "@/lib/ask/tools";
import { cn } from "@/lib/cn";
import type { Dataset } from "@/lib/dataset/dataset";
import { useTrainingData } from "@/lib/dataset/training";
import { formatLongDate } from "@/lib/format";
import { AnswerChart } from "./answer-chart";
import { EvidencePanel } from "./evidence-panel";
import { markAsked } from "@/lib/onboarding";
import { useLiveAi } from "@/components/ai-status";

class AskUnavailable extends Error {}

const liveModel: CallModel = async (messages) => {
  const res = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages }) });
  const data = (await res.json().catch(() => null)) as AskReply | { error: string } | null;
  if (!data || "error" in data) throw new Error(data?.error ?? "Ask failed.");
  if (data.status !== "ok") throw new AskUnavailable(data.message);
  return { content: data.content, stop_reason: data.stop_reason };
};

type Turn = {
  question: string;
  steps: Step[];
  scripted: boolean;
  state:
    | { status: "running" }
    | { status: "answered"; answer: Answer }
    | { status: "text"; text: string }
    | { status: "error"; message: string; unavailable: boolean };
};

type Selection = { turn: number; segment: number };

function preambleFor(data: Dataset) {
  const first = data.sessions[0]?.date;
  return `Lifter's data: ${data.label}. ${data.sessions.length} sessions from ${first} to ${data.end}; treat ${data.end} as today. Weights are in lb.`;
}

/** Questions worth asking about this dataset, chosen by code (plateau detection), not the AI. */
function suggestionsFor(data: Dataset) {
  const plateaus = runTool(data, "find_plateaus", { min_weeks: 6 }, "s").forModel.plateaus as Array<{ exercise: string }> | undefined;
  const out = (plateaus ?? []).slice(0, 2).map((p) => `Why did my ${p.exercise.toLowerCase()} stall?`);
  out.push("How has my training changed over the last 3 months?");
  return out;
}

function StepList({ steps, running }: { steps: Step[]; running: boolean }) {
  return (
    <details open={running || undefined} className="border-y border-border">
      <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-base font-medium text-fg-secondary">
        <span>How this was worked out{steps.length ? ` · ${steps.length} step${steps.length === 1 ? "" : "s"}` : ""}</span>
        {running ? <span className="font-mono text-xs text-ai-text">Thinking…</span> : null}
      </summary>
      <ol className="m-0 mb-3.5 flex list-none flex-col gap-2 p-0">
        {steps.map((s) => (
          <li key={s.id} className="grid grid-cols-[20px_1fr] items-baseline gap-2.5 font-mono text-sm text-fg-secondary">
            {s.ok ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--bp-accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="Done">
                <path d="M5 12l5 5 9-10" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--bp-danger)" strokeWidth="2.5" strokeLinecap="round" role="img" aria-label="Failed">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            )}
            <span>{s.label}</span>
          </li>
        ))}
        {running ? <li className="pl-[30px] font-mono text-sm text-muted">…</li> : null}
      </ol>
    </details>
  );
}

export function AskView() {
  const params = useSearchParams();
  const router = useRouter();
  const dataset = useTrainingData();
  const live = useLiveAi();
  const [thread, setThread] = useState<Thread>(emptyThread);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [draft, setDraft] = useState("");
  const startedFor = useRef<string | null>(null);

  const data = dataset.status === "ready" ? dataset.dataset : null;
  const busy = turns.at(-1)?.state.status === "running";

  async function ask(question: string, opts: { scripted?: boolean; fresh?: boolean } = {}) {
    if (!data || !question.trim()) return;
    const base = opts.fresh ? emptyThread() : thread;
    const index = opts.fresh ? 0 : turns.length;
    const turn: Turn = { question: question.trim(), steps: [], scripted: !!opts.scripted, state: { status: "running" } };
    setTurns((t) => (opts.fresh ? [turn] : [...t, turn]));
    setSelected(null);
    setDraft("");

    const update = (patch: Partial<Turn>) => setTurns((t) => t.map((x, i) => (i === index ? { ...x, ...patch } : x)));
    // Public demo: no live AI. Say so plainly and offer the scripted example instead of failing.
    if (!opts.scripted && !live) {
      update({
        state: {
          status: "error",
          message: "Live AI is turned off on this public demo, so new questions can’t be answered here. The scripted example shows exactly how Ask works.",
          unavailable: true,
        },
      });
      return;
    }
    const steps: Step[] = [];
    const { thread: next, outcome } = await runTurn({
      thread: base,
      question: question.trim(),
      preamble: base.messages.length ? undefined : preambleFor(data),
      data,
      callModel: opts.scripted ? exampleModel() : liveModel,
      onStep: (s) => {
        steps.push(s);
        update({ steps: [...steps] });
      },
    });
    setThread(next);
    if (outcome.status === "answered") {
      update({ steps: outcome.steps, state: { status: "answered", answer: outcome.answer } });
      markAsked();
    }
    else if (outcome.status === "text") update({ steps: outcome.steps, state: { status: "text", text: outcome.text } });
    else update({ steps: outcome.steps, state: { status: "error", message: outcome.message, unavailable: false } });
  }

  // A question can arrive in the URL from the Ask bar or a suggestion link.
  const q = params.get("q");
  useEffect(() => {
    if (!q || !data || startedFor.current === q) return;
    startedFor.current = q;
    void ask(q, { fresh: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per question
  }, [q, data]);

  if (!data) {
    return <PageHeader trail="Review / Ask" title="Ask your history" meta="Loading your history…" />;
  }

  const results: Record<string, ToolResult> = thread.results;
  const sel = selected ? turns[selected.turn]?.state : null;
  const selAnswer = sel && sel.status === "answered" ? sel.answer : null;
  const selSegment = selAnswer && selected ? selAnswer.input.answer[selected.segment] : null;
  const selResult = selSegment?.evidence ? results[selSegment.evidence.result_id] : null;

  const submit = (text: string) => {
    if (busy) return;
    if (!turns.length) router.replace(`/review/ask?q=${encodeURIComponent(text)}`, { scroll: false });
    void ask(text, { fresh: !turns.length });
  };

  return (
    // data-ask-page: Ask has its own input, so the phone Ask button steps aside here.
    <div data-ask-page className="flex flex-wrap items-start gap-8">
      <div className="flex min-w-0 flex-[999_1_640px] flex-col gap-10">
        {!turns.length ? (
          <>
            <PageHeader trail="Review / Ask" title={<>Ask your <span className="font-normal italic">history</span></>} meta={`${data.label} · ${data.sessions.length} sessions`} />
            <Card className="flex flex-col gap-4 p-5">
              <Eyebrow>Worth asking</Eyebrow>
              <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                {suggestionsFor(data).map((s) => (
                  <li key={s}>
                    <Button variant="secondary" size="sm" onClick={() => submit(s)}>
                      {s}
                    </Button>
                  </li>
                ))}
              </ul>
              <p className="m-0 text-sm text-muted">
                Your log stays in this browser. The AI chooses which analysis to run; code runs it here and only the results are sent.
              </p>
            </Card>
          </>
        ) : null}

        {turns.map((turn, ti) => (
          <article key={ti} className="flex flex-col gap-6" aria-busy={turn.state.status === "running"}>
            <div className="flex flex-col gap-2">
              {ti === 0 ? <Eyebrow>Review / Ask</Eyebrow> : null}
              {ti === 0 ? (
                <h1 className="m-0 font-display text-4xl font-medium tracking-[-0.02em]">{turn.question}</h1>
              ) : (
                <h2 className="m-0 font-display text-3xl font-medium tracking-[-0.01em]">{turn.question}</h2>
              )}
              <span className="font-mono text-sm text-muted">
                {data.label} · {formatLongDate(data.sessions[0].date)} – {formatLongDate(data.end)}
              </span>
            </div>

            {turn.scripted ? (
              <p className="m-0 rounded-md border border-border bg-surface px-4 py-3 text-base text-fg-secondary">
                <span className="font-semibold text-fg">Scripted example.</span> The AI’s side of this conversation is scripted to show how Ask works.
                The tool calls really ran on the sample data, and every number and chart below was computed just now.
              </p>
            ) : null}

            {turn.state.status === "error" && turn.state.unavailable ? null : <StepList steps={turn.steps} running={turn.state.status === "running"} />}
            <p role="status" className="sr-only">
              {turn.state.status === "running" ? "Working out the answer…" : turn.state.status === "answered" || turn.state.status === "text" ? "Answer ready." : ""}
            </p>

            {turn.state.status === "error" ? (
              <ErrorCard
                calm={turn.state.unavailable}
                message={turn.state.message}
                canScript={data.kind === "sample"}
                onScript={() => {
                  router.replace(`/review/ask`, { scroll: false });
                  startedFor.current = null;
                  void ask(EXAMPLE_QUESTION, { scripted: true, fresh: true });
                }}
              />
            ) : null}

            {turn.state.status === "text" ? <p className="m-0 font-display text-2xl leading-[1.45]">{turn.state.text}</p> : null}

            {turn.state.status === "answered" ? (
              <AnswerBody
                evidence={
                  selected?.turn === ti && selSegment?.evidence && selResult?.evidence ? (
                    // Below the large breakpoint the evidence opens right under the answer.
                    <div className="lg:hidden">
                      <EvidencePanel
                        result={selResult}
                        range={{ from: selSegment.evidence.from, to: selSegment.evidence.to }}
                        claim={selSegment.text}
                        onClose={() => setSelected(null)}
                      />
                    </div>
                  ) : null
                }
                answer={turn.state.answer}
                results={results}
                selected={selected?.turn === ti ? selected.segment : null}
                onSelect={(segment) => setSelected(segment === null || (selected?.turn === ti && selected.segment === segment) ? null : { turn: ti, segment })}
                onFollowUp={(f) => submit(f)}
                busy={busy}
                scripted={turn.scripted}
              />
            ) : null}
          </article>
        ))}

        {turns.length && !turns[0].scripted ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(draft);
            }}
            className="flex h-12 items-center gap-2 field rounded-md border border-border-input bg-surface pr-2 pl-4"
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-label="Ask a follow-up"
              placeholder="Ask a follow-up…"
              disabled={busy}
              className="min-w-0 flex-1 bg-transparent text-md text-fg outline-none placeholder:text-muted"
            />
            <Button type="submit" variant="ink" size="sm" disabled={busy || !draft.trim()}>
              Ask
            </Button>
          </form>
        ) : null}

        {!turns.length ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(draft);
            }}
            className="flex h-12 items-center gap-2 field rounded-md border border-border-input bg-surface pr-2 pl-4"
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-label="Ask about your training"
              placeholder="Ask about your training…"
              className="min-w-0 flex-1 bg-transparent text-md text-fg outline-none placeholder:text-muted"
            />
            <Button type="submit" variant="ink" size="sm" disabled={!draft.trim()}>
              Ask
            </Button>
          </form>
        ) : null}
      </div>

      {selSegment?.evidence && selResult?.evidence ? (
        <div id="evidence" className="hidden min-w-0 flex-[1_1_340px] lg:block lg:max-w-[440px]">
          <EvidencePanel
            result={selResult}
            range={{ from: selSegment.evidence.from, to: selSegment.evidence.to }}
            claim={selSegment.text}
            onClose={() => setSelected(null)}
          />
        </div>
      ) : null}
    </div>
  );
}

function ErrorCard({ message, canScript, onScript, calm = false }: { message: string; canScript: boolean; onScript: () => void; calm?: boolean }) {
  return (
    <Card className="flex flex-col gap-3 p-5">
      {/* "Live AI is off" is information, not an error. */}
      <p role={calm ? "status" : "alert"} className="m-0 text-md">
        {message}
      </p>
      {canScript ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant={calm ? "primary" : "secondary"} onClick={onScript}>
            See a scripted example
          </Button>
          <span className="text-sm text-muted">Runs the real tools on the sample data, with the AI’s side scripted.</span>
        </div>
      ) : null}
    </Card>
  );
}

function AnswerBody({
  answer,
  results,
  selected,
  onSelect,
  onFollowUp,
  busy,
  scripted,
  evidence,
}: {
  evidence: ReactNode;
  answer: Answer;
  results: Record<string, ToolResult>;
  selected: number | null;
  onSelect: (segment: number | null) => void;
  onFollowUp: (q: string) => void;
  busy: boolean;
  scripted: boolean;
}) {
  const { input, check } = answer;
  const focus = selected !== null ? input.answer[selected]?.evidence : null;
  const unverifiedCount = Object.keys(check.unverified).length;

  return (
    <>
      {input.charts.length ? (
        <Card className="flex flex-col gap-6 px-6 py-5">
          {input.charts.map((c, i) => {
            const r = results[c.result_id];
            if (!r?.chart) return null;
            // Outline the claim's dates on its own chart, or on every chart when the cited result has none (e.g. a comparison).
            const dated = focus && (focus.from || focus.to);
            const focusHere = dated && (focus.result_id === c.result_id || !results[focus.result_id]?.chart) ? focus : null;
            return (
              <div key={i} className={cn(i > 0 && "border-t border-dashed border-border pt-5")}>
                <AnswerChart chart={r.chart} title={c.title} highlight={c.highlight} focus={focusHere ? { from: focusHere.from, to: focusHere.to } : null} />
              </div>
            );
          })}
        </Card>
      ) : null}

      <section aria-label="Answer" className="flex flex-col gap-4">
        <p className="m-0 font-display text-2xl leading-[1.45]">
          {input.answer.map((seg, i) => {
            const flagged = check.unverified[i];
            const content = (
              <>
                {seg.text}
                {flagged ? <span className="ml-1.5 inline-flex rounded-xs border border-danger px-1.5 align-middle font-mono text-xs text-danger">unverified: {flagged.join(", ")}</span> : null}
              </>
            );
            const cited = seg.evidence && results[seg.evidence.result_id]?.evidence;
            return (
              <span key={i}>
                {i ? " " : ""}
                {cited ? (
                  // A link, not a button: buttons can't wrap across lines inside a sentence.
                  <a
                    href="#evidence"
                    onClick={(e) => {
                      e.preventDefault();
                      onSelect(i);
                    }}
                    aria-current={selected === i ? "true" : undefined}
                    className={cn(
                      "cursor-pointer text-fg no-underline decoration-clone",
                      selected === i
                        ? "rounded-xs bg-ai-mark outline-2 outline-offset-2 outline-ai"
                        : "border-b-[1.5px] border-dashed border-ai hover:bg-ai-wash",
                    )}
                  >
                    {content}
                  </a>
                ) : (
                  content
                )}
              </span>
            );
          })}
        </p>
        {input.caveat ? <p className="ai-reasoning m-0">{input.caveat} Tap a highlighted line to see the sets behind it.</p> : null}
        {unverifiedCount ? (
          <p className="m-0 text-sm text-danger">Some numbers above didn’t match any computed result, so they’re marked unverified.</p>
        ) : null}
      </section>

      {evidence}

      {input.suggestion ? (
        <section aria-label="Suggestion" className="ai-proposal flex flex-col gap-3 px-5 py-4">
          <span className="font-mono text-xs tracking-[0.08em] text-ai-text uppercase">One thing to try</span>
          <span className="text-md">{input.suggestion}</span>
          <span className="text-sm text-fg-secondary">
            A suggestion, not a change. Your plan only changes when you change it: edit your program and{" "}
            <Link href="/plan/import" className="font-medium text-link underline-offset-4 hover:underline">
              import it again
            </Link>
            .
          </span>
        </section>
      ) : null}

      {input.follow_ups.length && !scripted ? (
        <div className="flex flex-wrap gap-2">
          {input.follow_ups.slice(0, 3).map((f) => (
            <Button key={f} variant="secondary" size="sm" onClick={() => onFollowUp(f)} disabled={busy}>
              {f}
            </Button>
          ))}
        </div>
      ) : null}
      {scripted ? <p className="m-0 text-sm text-muted">Follow-up questions need a live AI connection.</p> : null}
    </>
  );
}
