"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { AiMark, Eyebrow, Reasoning, Tag } from "@/components/ui/text";
import { athlete, gyms } from "@/data/seed";
import {
  applyChanges,
  checkProposals,
  effectsOf,
  mentionsPain,
  quoteConstraint,
  toAdjustments,
  upcomingSessions,
  type CheckedChange,
  type RejectedChange,
  type Upcoming,
} from "@/lib/adapt/changes";
import { EXAMPLE_CONSTRAINT, EXAMPLE_GYM_ID, EXAMPLE_PROPOSALS, EXAMPLE_SUMMARY } from "@/lib/adapt/example";
import type { AdaptReply, AdaptRequest } from "@/lib/adapt/schema";
import { cn } from "@/lib/cn";
import { useTrainingData } from "@/lib/dataset/training";
import type { Exercise, GymProfile } from "@/lib/domain/types";
import { formatLoad } from "@/lib/format";
import { useActiveProgram, type ActiveProgram } from "@/lib/program/store";
import { progressStore, useProgress, type Progress } from "@/lib/train/store";

const STARTERS: Array<{ label: string; text: string; gym?: string }> = [
  { label: "Traveling", text: "Traveling for my next three sessions, hotel gym only.", gym: "hotel" },
  { label: "Short on time", text: "I only have 35 minutes for my next two sessions." },
  { label: "Run down", text: "Slept badly all week and feel run down. Keep the next session light." },
  { label: "Something hurts", text: "My lower back hurts a bit after the last deadlift session." },
];

const SAFETY_NOTE =
  "Pain is worth getting checked by a doctor or physio, especially if it’s sharp, gets worse, or doesn’t settle in a few days. These changes only take load off; they aren’t treatment.";

type Decision = "accepted" | "declined";
type Proposal = {
  constraint: string;
  gym: GymProfile | null;
  upcoming: Upcoming[];
  summary: string;
  safetyNote: string | null;
  accepted: CheckedChange[];
  rejected: RejectedChange[];
  scripted: boolean;
};

/** Bend the week (F3): temporary, checked changes to the coming sessions. */
export function AdaptView() {
  const program = useActiveProgram();
  const active = program.status === "ready" ? program.active : null;
  const progress = useProgress(active);
  const data = useTrainingData();

  if (!active || progress.status !== "ready" || data.status !== "ready") {
    return <PageHeader trail="Plan / Bend the week" title="Loading your program…" />;
  }
  return <Adapt active={active} progress={progress.value} sessions={data.dataset.sessions} end={data.dataset.end} />;
}

function Adapt({ active, progress, sessions, end }: { active: ActiveProgram; progress: Progress; sessions: Parameters<typeof checkProposals>[0]["sessions"]; end: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [constraint, setConstraint] = useState(() => params.get("c") ?? "");
  const [gymId, setGymId] = useState("");
  const [count, setCount] = useState(Math.min(3, active.program.days.length));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [decisions, setDecisions] = useState<Record<number, Decision>>({});

  const { program, exercises } = active;
  const nextDay = program.days[progress.dayIndex % program.days.length];
  // The scripted example is written for the sample program with Day B2 next.
  const exampleFits = active.kind === "sample" && nextDay.id === "B2";
  const pending = progress.adjustments ?? [];

  function open(next: Proposal) {
    setProposal(next);
    setDecisions({});
    setError(null);
  }

  function check(opts: { constraint: string; gym: GymProfile | null; upcoming: Upcoming[]; summary: string; safetyNote: string | null; proposals: typeof EXAMPLE_PROPOSALS; scripted: boolean }) {
    const { accepted, rejected } = checkProposals({ proposals: opts.proposals, upcoming: opts.upcoming, exercises, gym: opts.gym, sessions, end, athlete });
    // Pain always gets the same note, whatever the model wrote.
    const safetyNote = mentionsPain(opts.constraint) ? SAFETY_NOTE : opts.safetyNote;
    open({ ...opts, safetyNote, accepted, rejected });
  }

  async function propose() {
    const gym = gyms.find((g) => g.id === gymId) ?? null;
    const upcoming = upcomingSessions(program, progress.state, progress.dayIndex, athlete, count);
    const body: AdaptRequest = {
      constraint: constraint.trim(),
      gym: gym ? { name: gym.name, equipment: gym.equipment, maxDumbbell: gym.maxDumbbell ?? null } : null,
      sessions: upcoming.map((u) => ({
        position: u.position,
        day: u.day.name,
        slots: u.prescriptions.map((p) => {
          const e = exercises.get(p.slot.exerciseId)!;
          return { slot_key: p.key, exercise: e.name, equipment: e.equipment, pattern: e.pattern, scheme: p.scheme, weight: p.sets?.at(-1)?.weight ?? null };
        }),
      })),
      library: [...exercises.values()].map((e) => ({ id: e.id, name: e.name, equipment: e.equipment, pattern: e.pattern, muscles: e.muscles })),
    };
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/adapt-week", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const reply = (await res.json().catch(() => null)) as AdaptReply | { error: string } | null;
      if (!reply || "error" in reply) setError(reply?.error ?? "Adjusting the week failed.");
      else if (reply.status !== "ok") setError(reply.message);
      else
        check({
          constraint: body.constraint,
          gym,
          upcoming,
          summary: reply.proposal.summary,
          safetyNote: reply.proposal.safety_note,
          proposals: reply.proposal.changes,
          scripted: false,
        });
    } catch {
      setError("Couldn’t reach the server. Bending the week needs a connection; your plan is unchanged.");
    } finally {
      setBusy(false);
    }
  }

  function runExample() {
    const gym = gyms.find((g) => g.id === EXAMPLE_GYM_ID)!;
    setConstraint(EXAMPLE_CONSTRAINT);
    setGymId(gym.id);
    setCount(4);
    check({
      constraint: EXAMPLE_CONSTRAINT,
      gym,
      upcoming: upcomingSessions(program, progress.state, progress.dayIndex, athlete, 4),
      summary: EXAMPLE_SUMMARY,
      safetyNote: null,
      proposals: EXAMPLE_PROPOSALS,
      scripted: true,
    });
  }

  async function apply() {
    if (!proposal) return;
    const chosen = proposal.accepted.filter((_, i) => decisions[i] === "accepted");
    const adjustments = toAdjustments(chosen, proposal.upcoming, proposal.constraint, `adj-${Date.now()}`);
    await progressStore(active).set({ ...progress, adjustments });
    router.push("/train");
  }

  const acceptedCount = proposal ? proposal.accepted.filter((_, i) => decisions[i] === "accepted").length : 0;
  const undecided = proposal ? proposal.accepted.filter((_, i) => !decisions[i]).length : 0;

  return (
    <>
      <PageHeader
        trail="Plan / Bend the week"
        title={
          <>
            Bend the <span className="font-normal italic">week</span>
          </>
        }
        meta={proposal ? `${proposal.constraint}` : `${program.name} · Day ${nextDay.name} is next · changes are temporary`}
      />

      {proposal ? (
        <ProposalView
          proposal={proposal}
          exercises={exercises}
          decisions={decisions}
          onDecide={(i, d) => setDecisions((prev) => ({ ...prev, [i]: d }))}
          onAcceptAll={() => setDecisions(Object.fromEntries(proposal.accepted.map((_, i) => [i, "accepted" as const])))}
          footer={
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-muted">
                {acceptedCount} of {proposal.accepted.length} accepted{undecided ? ` · ${undecided} still to decide` : ""}. The program and its rules don’t change.
              </span>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setProposal(null)}>
                  Start over
                </Button>
                <Button variant="primary" onClick={apply} disabled={!acceptedCount}>
                  Apply {acceptedCount ? `${acceptedCount} ${acceptedCount === 1 ? "change" : "changes"}` : "changes"}
                </Button>
              </div>
            </div>
          }
        />
      ) : (
        <>
          {pending.length ? (
            <Card className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <span className="text-base text-fg-secondary">
                {pending.length} coming {pending.length === 1 ? "session is" : "sessions are"} already adjusted for {quoteConstraint(pending[0].constraint)}. Applying new changes replaces
                them.
              </span>
              <Button variant="secondary" size="sm" onClick={() => void progressStore(active).set({ ...progress, adjustments: [] })}>
                Clear them
              </Button>
            </Card>
          ) : null}
          <Card className="flex flex-col gap-5 p-5">
            <label className="flex flex-col gap-2">
              <Eyebrow>What changed?</Eyebrow>
              <textarea
                value={constraint}
                onChange={(e) => setConstraint(e.target.value)}
                rows={3}
                placeholder="Traveling, a different gym, less time, feeling run down…"
                className="min-h-28 resize-y rounded-md border border-border bg-bg p-4 font-display text-lg leading-[1.6] text-fg placeholder:text-muted focus:border-focus focus:outline-none"
              />
            </label>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Common reasons">
              {STARTERS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => {
                    setConstraint(s.text);
                    if (s.gym) setGymId(s.gym);
                  }}
                  className="rounded-full border border-border px-3 py-1.5 text-sm text-fg-secondary hover:bg-surface-raised hover:text-fg"
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex min-w-56 flex-1 flex-col gap-2">
                <Eyebrow>Where you’ll train</Eyebrow>
                <select
                  value={gymId}
                  onChange={(e) => setGymId(e.target.value)}
                  className="h-11 rounded-md border border-border bg-bg px-3 text-base text-fg focus:border-focus focus:outline-none"
                >
                  <option value="">Your usual gym</option>
                  {gyms
                    .filter((g) => g.id !== "home-gym")
                    .map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}: {g.equipment.join(", ")}
                        {g.maxDumbbell ? `, dumbbells to ${g.maxDumbbell} lb` : ""}
                      </option>
                    ))}
                </select>
              </label>
              <label className="flex w-44 flex-col gap-2">
                <Eyebrow>Sessions to look at</Eyebrow>
                <select
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className="h-11 rounded-md border border-border bg-bg px-3 text-base text-fg focus:border-focus focus:outline-none"
                >
                  {Array.from({ length: Math.max(4, program.days.length) }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      Next {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {error ? (
              <p role="alert" className="m-0 rounded-md border border-border bg-surface-raised px-4 py-3 text-base text-fg-secondary">
                {error}
                {exampleFits ? " You can still see how it works with the example." : ""}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-muted">The AI proposes swaps; code checks each one against your gym and sets the weights.</span>
              <div className="flex gap-2">
                {exampleFits ? (
                  <Button variant="secondary" onClick={runExample} disabled={busy}>
                    Use the example
                  </Button>
                ) : null}
                <Button variant="ai" onClick={propose} disabled={busy || constraint.trim().length < 3}>
                  {busy ? "Working it out…" : "Propose changes"}
                </Button>
              </div>
            </div>
          </Card>
        </>
      )}
    </>
  );
}

function ProposalView({
  proposal,
  exercises,
  decisions,
  onDecide,
  onAcceptAll,
  footer,
}: {
  proposal: Proposal;
  exercises: Map<string, Exercise>;
  decisions: Record<number, Decision>;
  onDecide: (index: number, d: Decision) => void;
  onAcceptAll: () => void;
  footer: ReactNode;
}) {
  const chosen = proposal.accepted.filter((_, i) => decisions[i] !== "declined");
  const effects = effectsOf(proposal.upcoming, chosen, exercises);
  const nameOf = (id: string) => exercises.get(id)?.name ?? id;

  return (
    <>
      {proposal.scripted ? (
        <p className="m-0 rounded-md border border-border bg-surface px-4 py-3 text-base text-fg-secondary">
          <span className="font-semibold text-fg">Scripted example.</span> The AI’s proposal is scripted to show how this works. Checking each change against the
          hotel gym, setting weights from your log and working out what the week loses all ran for real.
        </p>
      ) : null}

      {proposal.safetyNote ? (
        <p role="note" className="m-0 rounded-md border border-border-strong bg-surface px-4 py-3 text-base text-fg">
          <span className="font-semibold">A note on pain.</span> {proposal.safetyNote}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="flex flex-col gap-6">
          <Card className="ai-proposal flex flex-col gap-2 p-5">
            <Eyebrow className="text-ai-text">The AI’s proposal{proposal.gym ? ` · ${proposal.gym.name}` : ""}</Eyebrow>
            <Reasoning className="text-lg">{proposal.summary}</Reasoning>
            {proposal.accepted.length ? (
              <div>
                <Button variant="ink" size="sm" onClick={onAcceptAll}>
                  Accept all {proposal.accepted.length}
                </Button>
              </div>
            ) : (
              <span className="text-base text-fg-secondary">No change passed the checks, so there’s nothing to apply.</span>
            )}
          </Card>

          {proposal.upcoming.map((u) => {
            const indexed = proposal.accepted.map((c, i) => ({ c, i })).filter(({ c }) => c.position === u.position);
            return (
              <Card key={u.position}>
                <CardHeader
                  title={
                    <>
                      {u.position === 0 ? "Next" : `+${u.position}`} · Day {u.day.name}
                    </>
                  }
                  meta={indexed.length ? `${indexed.length} proposed ${indexed.length === 1 ? "change" : "changes"}` : "Unchanged"}
                />
                <ul className="m-0 list-none p-0">
                  {u.prescriptions.map((p) => {
                    const hit = indexed.find(({ c }) => c.change.slotKey === p.key);
                    const original = nameOf(p.slot.exerciseId);
                    if (!hit) {
                      return (
                        <li key={p.key} className="grid grid-cols-[36px_minmax(0,1fr)_auto] gap-3 border-b border-border px-5 py-3 text-fg-secondary last:border-b-0">
                          <span className="font-mono text-sm text-muted">{p.slot.tier}</span>
                          <span>
                            {original} <span className="font-mono text-sm">{p.scheme}</span>
                          </span>
                          <span className="font-mono text-sm">{weightOf(p.sets?.at(-1)?.weight ?? null, exercises.get(p.slot.exerciseId))}</span>
                        </li>
                      );
                    }
                    return (
                      <ChangeRow
                        key={p.key}
                        change={hit.c}
                        decision={decisions[hit.i]}
                        onDecide={(d) => onDecide(hit.i, d)}
                        original={original}
                        before={{ scheme: p.scheme, weight: weightOf(p.sets?.at(-1)?.weight ?? null, exercises.get(p.slot.exerciseId)) }}
                        after={applyChanges([p], [hit.c.change])[0]}
                        exercises={exercises}
                      />
                    );
                  })}
                </ul>
              </Card>
            );
          })}

          {footer}
        </div>

        <div className="flex flex-col gap-6 lg:sticky lg:top-6">
          <Card>
            <CardHeader title="What the week loses" meta="Calculated" />
            <div className="flex flex-col gap-4 p-5">
              {effects.muscles.length ? (
                <table className="w-full border-collapse text-base">
                  <caption className="sr-only">Sets per muscle group across these sessions, before and after</caption>
                  <thead>
                    <tr className="text-left font-mono text-xs text-muted uppercase">
                      <th className="pb-2 font-normal">Muscle</th>
                      <th className="pb-2 text-right font-normal">Sets</th>
                    </tr>
                  </thead>
                  <tbody>
                    {effects.muscles.map((m) => (
                      <tr key={m.muscle} className="border-t border-border">
                        <td className="py-2 capitalize">{m.muscle}</td>
                        <td className="py-2 text-right font-mono">
                          {m.before} → <span className={cn(m.after < m.before ? "text-fg" : "text-accent")}>{m.after}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="m-0 text-base text-fg-secondary">Same sets for every muscle group.</p>
              )}
              {effects.paused.length ? (
                <div className="flex flex-col gap-1.5">
                  <Eyebrow>Held at their targets</Eyebrow>
                  <p className="m-0 text-sm text-fg-secondary">
                    {effects.paused.join(", ")}. A swapped or skipped lift doesn’t progress or fail; it picks up where it left off.
                  </p>
                </div>
              ) : null}
            </div>
          </Card>

          {proposal.rejected.length ? (
            <Card>
              <CardHeader title="Turned down by the checks" meta={`${proposal.rejected.length}`} />
              <ul className="m-0 flex list-none flex-col gap-3 p-5">
                {proposal.rejected.map((r, i) => (
                  <li key={i} className="flex flex-col gap-0.5 text-sm">
                    <span className="text-fg">{describeRejected(r, proposal.upcoming, nameOf)}</span>
                    <span className="text-fg-secondary">{r.why}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}

function describeRejected(r: RejectedChange, upcoming: Upcoming[], nameOf: (id: string) => string) {
  const u = upcoming[r.proposal.position];
  const p = u?.prescriptions.find((x) => x.key === r.proposal.slot_key);
  const lift = p ? `${nameOf(p.slot.exerciseId)} on Day ${u.day.name}` : r.proposal.slot_key;
  if (r.proposal.kind === "swap") return `Swap ${lift} for ${r.proposal.exercise_id ? nameOf(r.proposal.exercise_id) : "?"}`;
  return r.proposal.kind === "reduce" ? `${r.proposal.sets ?? "?"} sets of ${lift}` : `Skip ${lift}`;
}

function weightOf(weight: number | null, exercise: Exercise | undefined) {
  if (weight === null) return "no weight yet";
  if (weight === 0 && exercise?.equipment !== "bodyweight") return "pick on the day";
  return formatLoad(weight, exercise?.equipment === "bodyweight");
}

function ChangeRow({
  change,
  decision,
  onDecide,
  original,
  before,
  after,
  exercises,
}: {
  change: CheckedChange;
  decision: Decision | undefined;
  onDecide: (d: Decision) => void;
  original: string;
  before: { scheme: string; weight: string };
  after: ReturnType<typeof applyChanges>[number];
  exercises: Map<string, Exercise>;
}) {
  const c = change.change;
  const replacement = c.kind === "swap" ? exercises.get(c.exerciseId) : undefined;
  const label = c.kind === "swap" ? "Swap" : c.kind === "reduce" ? "Fewer sets" : "Skip";
  return (
    <li
      className={cn(
        "flex flex-col gap-3 border-b border-border px-5 py-4 last:border-b-0",
        !decision && "bg-ai-wash",
        decision === "declined" && "opacity-60",
      )}
    >
      <div className="grid grid-cols-[36px_minmax(0,1fr)] gap-x-3 gap-y-1.5 sm:grid-cols-[36px_minmax(0,1fr)_auto]">
        <span className="font-mono text-sm text-muted">{after.slot.tier}</span>
        <span className="flex flex-col gap-1">
          <span className="text-sm text-muted line-through">
            {original} {before.scheme} · {before.weight}
          </span>
          <span className="text-md font-semibold">
            {c.kind === "skip" ? (
              <>Skipped this time</>
            ) : decision ? (
              <>{replacement?.name ?? original}</>
            ) : (
              <AiMark>{replacement?.name ?? original}</AiMark>
            )}{" "}
            {c.kind !== "skip" ? <span className="font-mono text-sm font-medium text-fg-secondary">{after.scheme}</span> : null}{" "}
            <Tag tone={decision === "accepted" ? "confirmed" : decision ? "neutral" : "ai"}>{label}</Tag>
          </span>
        </span>
        <span className="col-start-2 font-mono text-lg sm:col-start-3 sm:row-start-1 sm:text-right">
          {c.kind === "skip" ? "—" : weightOf(after.sets?.at(-1)?.weight ?? null, replacement ?? exercises.get(after.slot.exerciseId))}
        </span>
        <span className="col-start-2 text-sm text-fg-secondary sm:col-span-2">
          {c.reason}
          {c.kind === "swap" && c.estimatedFrom ? (
            <span className="text-muted">
              {" "}
              · No {replacement?.name} in your log, so this is estimated from your {c.estimatedFrom}. Adjust it on the day.
            </span>
          ) : c.kind === "swap" && c.weight === null && replacement?.equipment !== "bodyweight" ? (
            <span className="text-muted"> · No {replacement?.name} in your log, so pick a weight on the day.</span>
          ) : null}
        </span>
        {change.warnings.map((w) => (
          <span key={w} className="col-start-2 text-sm text-ai-text sm:col-span-2">
            Check: {w}
          </span>
        ))}
      </div>
      <div className="flex gap-2 pl-[48px]" role="group" aria-label={c.kind === "swap" ? `Swap ${original} for ${replacement?.name ?? c.exerciseId}` : `${label}: ${original}`}>
        <Button size="sm" variant={decision === "accepted" ? "ink" : "secondary"} aria-pressed={decision === "accepted"} onClick={() => onDecide("accepted")}>
          {decision === "accepted" ? "Accepted" : "Accept"}
        </Button>
        <Button size="sm" variant="secondary" aria-pressed={decision === "declined"} onClick={() => onDecide("declined")}>
          {decision === "declined" ? "Declined" : "Decline"}
        </Button>
      </div>
    </li>
  );
}

