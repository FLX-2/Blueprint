"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOffline } from "next/offline";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeftIcon } from "@/components/icons";
import { applyChanges, explainAdjusted } from "@/lib/adapt/changes";
import { athlete } from "@/data/seed";
import { useFocusWhenLost } from "@/lib/a11y/focus";
import { TierLabel } from "@/components/ui/terms";
import { cn } from "@/lib/cn";
import { TIER_NAMES, dayLabel, dayTitle } from "@/lib/domain/describe";
import { useTrainingData } from "@/lib/dataset/training";
import type { Exercise } from "@/lib/domain/types";
import { prescribe } from "@/lib/engine/engine";
import { platesFor } from "@/lib/engine/plates";
import { formatLoad } from "@/lib/format";
import { useActiveProgram, type ActiveProgram } from "@/lib/program/store";
import { finishSession, isComplete, logSet, moveTo, startSession, undoLast, type ActiveSession } from "@/lib/train/session";
import { activeSessionStore, adjustmentFor, localDate, logStore, progressStore, useProgress, type Progress } from "@/lib/train/store";

/** Re-renders every `ms` while mounted (for timers). */
function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/** Keeps the screen on during a session, re-acquiring after the tab comes back. */
function useWakeLock(on: boolean) {
  useEffect(() => {
    if (!on || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const acquire = () => {
      if (document.visibilityState === "visible") navigator.wakeLock.request("screen").then((l) => (lock = l)).catch(() => {});
    };
    acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      document.removeEventListener("visibilitychange", acquire);
      lock?.release().catch(() => {});
    };
  }, [on]);
}

const mmss = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

function Stepper({
  label,
  unit,
  value,
  onChange,
  step,
  min,
  format,
}: {
  label: string;
  unit?: string;
  value: number;
  onChange: (v: number) => void;
  step: number;
  min: number;
  format: (v: number) => string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-gym-track px-2 py-1.5">
      <button type="button" aria-label={`Less ${label.toLowerCase()}`} onClick={() => onChange(Math.max(min, value - step))} className="flex size-12 items-center justify-center rounded-lg text-2xl text-gym-text hover:bg-gym-track">
        −
      </button>
      <span className="flex flex-col items-center">
        <span className="font-mono text-[11px] tracking-[0.08em] text-gym-muted uppercase">{label}</span>
        <output aria-live="polite" className="num text-xl font-medium">
          {format(value)}
          {unit ? <span className="ml-1 text-sm text-gym-muted">{unit}</span> : null}
        </output>
      </span>
      <button type="button" aria-label={`More ${label.toLowerCase()}`} onClick={() => onChange(value + step)} className="flex size-12 items-center justify-center rounded-lg text-2xl text-gym-text hover:bg-gym-track">
        +
      </button>
    </div>
  );
}

/** The current set. Keyed by set, so its adjustments reset when the set changes. */
function SetPanel({ session, exercise, onLog }: { session: ActiveSession; exercise: Exercise; onLog: (weight: number, reps: number) => void }) {
  const slot = session.slots[session.cursor.slot];
  const set = slot.sets[session.cursor.set];
  const [weight, setWeight] = useState(set.weight);
  const [reps, setReps] = useState(set.targetReps);
  const bodyweight = exercise.equipment === "bodyweight";
  const plates = exercise.equipment === "barbell" ? platesFor(weight, athlete.barWeight) : null;
  const changed = weight !== set.weight || reps !== set.targetReps;
  // A swapped-in lift with no history has no weight yet: the lifter picks one.
  const needsWeight = !bodyweight && weight === 0;
  // Logging a set swaps in the next set's panel; keep focus on Log.
  const logRef = useFocusWhenLost<HTMLButtonElement>();

  return (
    <div className="step-forward flex flex-col gap-4">
      <p className="m-0 mt-2 flex items-baseline gap-2">
        <span className="font-display text-gym font-medium tracking-[-0.03em]">{needsWeight ? "—" : bodyweight && weight === 0 ? "BW" : weight}</span>
        {needsWeight ? (
          <span className="font-mono text-md text-gym-muted">pick a weight</span>
        ) : bodyweight && weight === 0 ? null : (
          <span className="font-mono text-md text-gym-muted">{bodyweight ? "lb added" : "lb"}</span>
        )}
      </p>
      <p className="m-0 font-mono text-2xl font-medium">
        × {set.targetReps}
        {set.amrap ? "+" : ""} reps{set.amrap ? <span className="text-md text-gym-muted"> · as many as you can</span> : null}
      </p>
      {plates?.perSide.length ? <p className="m-0 font-mono text-sm text-gym-muted">Per side: {plates.perSide.join(" · ")}</p> : null}

      <div className="grid grid-cols-2 gap-2">
        <Stepper label={bodyweight ? "Added" : "Weight"} unit="lb" value={weight} onChange={setWeight} step={athlete.smallestPlatePair} min={0} format={String} />
        <Stepper label="Reps" value={reps} onChange={setReps} step={1} min={0} format={String} />
      </div>

      <button
        ref={logRef}
        type="button"
        onClick={() => onLog(weight, reps)}
        disabled={needsWeight}
        className="h-15 rounded-xl bg-accent text-lg font-semibold text-accent-fg active:brightness-95 disabled:opacity-50"
      >
        {needsWeight ? "Set the weight first" : changed ? `Log ${reps} × ${formatLoad(weight, bodyweight)}` : `Log set · ${reps} reps`}
      </button>
    </div>
  );
}

function Workout({ active, progress, session }: { active: ActiveProgram; progress: Progress; session: ActiveSession }) {
  const router = useRouter();
  const offline = useOffline();
  const now = useNow();
  const data = useTrainingData();
  const log = logStore.useValue();
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  // Read out by screen readers: what was logged, and when rest is over.
  const [announcement, setAnnouncement] = useState("");
  const endRef = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(false);
  useWakeLock(true);

  // Back on End once the dialog closes (after the page behind it stops being inert).
  useEffect(() => {
    if (wasConfirming.current && !confirming) endRef.current?.focus();
    wasConfirming.current = confirming;
  }, [confirming]);

  const day = active.program.days.find((d) => d.id === session.dayId)!;
  const slot = session.slots[session.cursor.slot];
  const exercise = active.exercises.get(slot.exerciseId)!;
  const complete = isComplete(session);
  const resting = session.restUntil !== null && session.restUntil > now;
  const done = session.slots.reduce((n, s) => n + s.sets.filter((x) => x.done).length, 0);
  const total = session.slots.reduce((n, s) => n + s.sets.length, 0);

  // Buzz once when rest is over.
  useEffect(() => {
    if (!session.restUntil) return;
    const left = session.restUntil - Date.now();
    if (left <= 0) return;
    const id = setTimeout(() => {
      navigator.vibrate?.([200, 100, 200]);
      setAnnouncement("Rest over.");
    }, left);
    return () => clearTimeout(id);
  }, [session.restUntil]);

  const save = (next: ActiveSession) => void activeSessionStore.set(next);

  async function finish() {
    if (data.status !== "ready" || log.status !== "ready") return;
    setSaving(true);
    const at = new Date();
    const { logged, state, summary } = finishSession({
      session,
      program: active.program,
      state: progress.state,
      exercises: active.exercises,
      athlete,
      history: data.dataset.sessions,
      date: localDate(at),
      now: at,
    });
    const adjustment = progress.adjustments?.find((a) => a.id === session.adjustmentId);
    const slotExercise = (key: string) => day.slots.find((s) => `${s.tier}:${s.exerciseId}` === key)?.exerciseId ?? key;
    const events = explainAdjusted(summary.events, adjustment, active.exercises, slotExercise);
    const lastEvents = { ...progress.lastEvents };
    for (const e of events) if (e.kind !== "skipped") lastEvents[e.key] = { ...e, date: logged.date };
    await logStore.set([...log.value, logged]);
    await progressStore(active).set({
      ...progress,
      state,
      dayIndex: (active.program.days.findIndex((d) => d.id === day.id) + 1) % active.program.days.length,
      lastEvents,
      lastSummary: { ...summary, events },
      // This day's adjustment is used up.
      adjustments: progress.adjustments?.filter((a) => a.id !== session.adjustmentId),
    });
    await activeSessionStore.set(null);
    router.replace("/train/summary");
  }

  return (
    <div className="gym flex min-h-dvh flex-col">
      <p role="status" className="sr-only">
        {announcement}
      </p>
      <header inert={confirming} className="flex items-center justify-between gap-2 px-2 py-2">
        <button
          ref={endRef}
          type="button"
          onClick={() => setConfirming(true)}
          aria-haspopup="dialog"
          className="flex h-11 items-center gap-1 px-2 font-medium text-gym-text"
        >
          <ChevronLeftIcon width={20} height={20} />
          End
        </button>
        <span className="font-mono text-xs tracking-[0.06em] text-gym-muted">
          {dayLabel(active.program, day).toUpperCase()} · {mmss(now - new Date(session.startedAt).getTime())}
        </span>
        <span className="w-16 text-right font-mono text-[11px] text-gym-muted">{offline ? "Offline · saved" : `${done}/${total}`}</span>
      </header>

      <nav inert={confirming} aria-label="Exercises" className="flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
        {session.slots.map((s, i) => {
          const n = s.sets.filter((x) => x.done).length;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => save(moveTo(session, i))}
              aria-current={i === session.cursor.slot ? "step" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm",
                i === session.cursor.slot ? "border-gym-text text-gym-text" : "border-gym-track text-gym-muted",
              )}
            >
              {active.exercises.get(s.exerciseId)?.name}
              <span className="num text-xs">
                {n}/{s.sets.length}
              </span>
            </button>
          );
        })}
      </nav>

      <main inert={confirming} className="mx-auto flex w-full max-w-[440px] flex-1 flex-col gap-4 px-6 pt-4 pb-8">
        {complete ? (
          <div className="flex flex-1 flex-col justify-center gap-4">
            <h1 className="m-0 font-display text-5xl font-medium">All sets done.</h1>
            <p className="m-0 text-md text-gym-muted">Finish to save the session and let the rules set your next targets.</p>
            <button type="button" onClick={finish} disabled={saving} className="h-15 rounded-xl bg-accent text-lg font-semibold text-accent-fg disabled:opacity-60">
              {saving ? "Saving…" : "Finish session"}
            </button>
            <button type="button" onClick={() => save(undoLast(session))} className="h-11 text-base text-gym-muted underline-offset-4 hover:underline">
              Undo last set
            </button>
          </div>
        ) : (
          <>
            <div className="flex justify-between font-mono text-xs tracking-[0.06em] text-gym-muted uppercase">
              <h1 className="m-0 text-xs font-normal">
                {exercise.name} · {TIER_NAMES[slot.tier].one} ({slot.tier}) · {slot.scheme}
              </h1>
              <span>
                SET {session.cursor.set + 1}/{slot.sets.length}
              </span>
            </div>
            <div className="flex gap-1.5" aria-hidden="true">
              {slot.sets.map((x, i) => (
                <div key={i} className={cn("h-1 flex-1 rounded-full transition-colors duration-300", x.done ? "bg-gym-text" : i === session.cursor.set ? "bg-accent" : "bg-gym-track")} />
              ))}
            </div>

            {resting ? (
              <div role="timer" aria-live="off" className="flex items-center justify-between rounded-xl border border-gym-track px-4 py-3">
                <span className="flex flex-col">
                  <span className="font-mono text-[11px] tracking-[0.08em] text-gym-muted uppercase">Rest</span>
                  <span className="num text-3xl font-medium">{mmss(session.restUntil! - now)}</span>
                </span>
                <span className="flex gap-2">
                  <button type="button" onClick={() => save({ ...session, restUntil: session.restUntil! + 30_000 })} className="h-11 rounded-lg border border-gym-track px-3 text-sm">
                    +30s
                  </button>
                  <button type="button" onClick={() => save({ ...session, restUntil: null })} className="h-11 rounded-lg border border-gym-track px-3 text-sm">
                    Skip
                  </button>
                </span>
              </div>
            ) : null}

            <SetPanel
              key={`${session.cursor.slot}-${session.cursor.set}`}
              session={session}
              exercise={exercise}
              onLog={(weight, reps) => {
                const next = logSet(session, { weight, reps }, Date.now());
                save(next);
                setAnnouncement(logAnnouncement(session, next, weight, reps, exercise, (id) => active.exercises.get(id)?.name ?? id));
              }}
            />
            {done ? (
              <button type="button" onClick={() => save(undoLast(session))} className="h-11 self-center text-sm text-gym-muted underline-offset-4 hover:underline">
                Undo last set
              </button>
            ) : null}
          </>
        )}
      </main>

      {confirming ? (
        <EndDialog onClose={() => setConfirming(false)}>
            <p className="m-0 text-base text-gym-muted">
              {done} of {total} sets logged. Finishing saves them and runs the rules; exercises with nothing logged keep their targets.
            </p>
            <button type="button" onClick={finish} disabled={saving || !done} className="h-14 rounded-xl bg-accent text-md font-semibold text-accent-fg disabled:opacity-50">
              {saving ? "Saving…" : "Finish now"}
            </button>
            <button
              type="button"
              data-autofocus
              onClick={() => setConfirming(false)}
              className="h-12 rounded-xl border border-gym-track text-md"
            >
              Keep going
            </button>
            <button
              type="button"
              onClick={async () => {
                await activeSessionStore.set(null);
                router.replace("/train");
              }}
              className="h-11 text-sm text-danger"
            >
              Discard session
            </button>
        </EndDialog>
      ) : null}
    </div>
  );
}

/** Gym mode: always dark, phone-first, and fully on-device. */
/** What a screen reader hears after a set: what was logged and what's next. */
function logAnnouncement(before: ActiveSession, after: ActiveSession, weight: number, reps: number, exercise: Exercise, nameOf: (id: string) => string) {
  const logged = `Logged ${reps} reps${weight ? ` at ${formatLoad(weight, exercise.equipment === "bodyweight")}` : ""}.`;
  if (isComplete(after)) return `${logged} All sets done.`;
  const rest = after.restUntil ? ` Rest ${mmss(after.restUntil - Date.now())}.` : "";
  const slot = after.slots[after.cursor.slot];
  const next = after.cursor.slot === before.cursor.slot ? `Next: set ${after.cursor.set + 1} of ${slot.sets.length}.` : `Next: ${nameOf(slot.exerciseId)}.`;
  return `${logged}${rest} ${next}`;
}

/** The end-session sheet: focus starts on "Keep going", Escape closes it. */
function EndDialog({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
  }, []);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="end-session-title"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      className="fixed inset-0 z-30 flex items-end bg-black/60 sm:items-center sm:justify-center"
    >
      <div ref={ref} className="flex w-full flex-col gap-3 rounded-t-2xl border border-gym-track bg-gym-bg p-6 sm:max-w-[420px] sm:rounded-2xl">
        <h2 id="end-session-title" className="m-0 font-display text-3xl font-medium">
          End this session?
        </h2>
        {children}
      </div>
    </div>
  );
}

export function GymMode() {
  const program = useActiveProgram();
  const session = activeSessionStore.useValue();
  const active = program.status === "ready" ? program.active : null;
  const progress = useProgress(active);

  if (!active || progress.status !== "ready" || session.status !== "ready") {
    return (
      <main className="gym flex min-h-dvh items-center justify-center font-mono text-sm text-gym-muted">
        <p role="status">Loading…</p>
      </main>
    );
  }

  const current = session.value;
  if (current && current.programId === active.program.id) {
    return <Workout active={active} progress={progress.value} session={current} />;
  }

  const day = active.program.days[progress.value.dayIndex % active.program.days.length];
  const adjustment = adjustmentFor(progress.value, day.id);
  const adjusted = applyChanges(prescribe(active.program, day, progress.value.state, athlete), adjustment?.changes ?? []);
  const prescriptions = adjusted.filter((p) => p.change?.kind !== "skip");
  const ready = prescriptions.filter((p) => p.sets);

  return (
    <div className="gym flex min-h-dvh flex-col">
      <header className="flex items-center px-2 py-2">
        <Link href="/train" className="flex h-11 items-center gap-1 px-2 font-medium text-gym-text no-underline">
          <ChevronLeftIcon width={20} height={20} />
          Train
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-[440px] flex-1 flex-col gap-5 px-6 pt-6 pb-8">
        <p className="m-0 font-mono text-xs tracking-[0.06em] text-gym-muted uppercase">
          {[active.program.name, dayTitle(active.program, day).code].filter(Boolean).join(" · ")}
        </p>
        <h1 className="m-0 font-display text-5xl font-medium tracking-[-0.02em]">{dayTitle(active.program, day).title}</h1>
        {current ? (
          <p className="m-0 rounded-xl border border-gym-track px-4 py-3 text-sm text-gym-muted">
            A session from another program is still open. Starting this one discards it.
          </p>
        ) : null}
        {adjustment ? (
          <p className="m-0 rounded-xl border border-gym-track px-4 py-3 text-sm text-gym-muted">
            Adjusted for: <span className="text-gym-text">{adjustment.constraint}</span>
          </p>
        ) : null}
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {adjusted.map((p) => {
            const exercise = active.exercises.get(p.slot.exerciseId)!;
            const top = p.sets?.at(-1);
            const skipped = p.change?.kind === "skip";
            const bodyweight = exercise.equipment === "bodyweight";
            return (
              <li key={p.key} className={cn("flex items-baseline justify-between gap-3 border-b border-gym-track pb-3", skipped && "text-gym-muted line-through")}>
                <span className="flex flex-col gap-0.5">
                  <TierLabel tier={p.slot.tier} className="text-gym-muted" />
                  <span>
                    {exercise.name} <span className="font-mono text-sm text-gym-muted">{p.scheme}</span>
                    {p.change && !skipped ? <span className="ml-2 font-mono text-[11px] text-gym-muted no-underline">adjusted</span> : null}
                  </span>
                </span>
                <span className="num text-lg">{skipped ? "skip" : top ? (top.weight === 0 && !bodyweight ? "pick" : formatLoad(top.weight, bodyweight)) : "—"}</span>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          disabled={!ready.length}
          onClick={() =>
            void activeSessionStore.set(
              startSession({ id: `log-${Date.now()}`, programId: active.program.id, day, prescriptions, now: new Date(), adjustmentId: adjustment?.id }),
            )
          }
          className="mt-auto h-15 rounded-xl bg-accent text-lg font-semibold text-accent-fg disabled:opacity-50"
        >
          Start session
        </button>
        <p className="m-0 text-center font-mono text-xs text-gym-muted">Saved on this device after every set. Works offline.</p>
      </main>
    </div>
  );
}
