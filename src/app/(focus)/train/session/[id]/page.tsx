import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeftIcon } from "@/components/icons";
import { getExercise, program, sessions } from "@/data/seed";
import { formatScheme, lastTimeFor, nextDay } from "@/lib/domain/describe";

export const metadata: Metadata = { title: "Session" };

// Only the demo session exists until sessions are created from Train (Phase 2),
// so the page doesn't read `id` yet.
export function generateStaticParams() {
  return [{ id: "demo" }];
}

export default function SessionPage() {
  const day = nextDay(program, sessions);
  const slot = day.slots[0];
  const exercise = getExercise(slot.exerciseId);
  const working = lastTimeFor(sessions, slot.exerciseId, day.id)?.sets[0]?.weight ?? 0;
  const done = 2;

  return (
    <div className="gym flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-2 py-2">
        <Link href="/train" className="flex h-11 items-center gap-1 px-2 font-medium text-gym-text no-underline">
          <ChevronLeftIcon width={20} height={20} />
          End
        </Link>
        <span className="font-mono text-xs tracking-[0.06em] text-gym-muted">DAY {day.name} · DEMO</span>
        <span className="w-16" aria-hidden="true" />
      </header>

      <main className="mx-auto flex w-full max-w-[440px] flex-1 flex-col gap-4 px-6 pt-6 pb-8">
        <div className="flex justify-between font-mono text-xs tracking-[0.06em] text-gym-muted">
          <span>
            {exercise.name.toUpperCase()} · {slot.tier}
          </span>
          <span>
            SET {done + 1}/{slot.scheme.sets}
          </span>
        </div>
        <div className="flex gap-1.5" aria-hidden="true">
          {Array.from({ length: slot.scheme.sets }, (_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full ${i < done ? "bg-gym-text" : i === done ? "bg-accent" : "bg-gym-track"}`}
            />
          ))}
        </div>

        <p className="m-0 mt-6 flex items-baseline gap-2">
          <span className="font-display text-gym font-medium tracking-[-0.03em]">{working}</span>
          <span className="font-mono text-md text-gym-muted">lb</span>
        </p>
        <p className="m-0 font-mono text-2xl font-medium">× {slot.scheme.reps} reps</p>
        <p className="m-0 font-mono text-sm text-gym-muted">
          {formatScheme(slot.scheme)} · rest 02:30 · logging arrives in Phase 2
        </p>

        <button
          type="button"
          disabled
          className="mt-auto h-15 rounded-xl bg-accent text-lg font-semibold text-accent-fg disabled:opacity-60"
        >
          Log set
        </button>
      </main>
    </div>
  );
}
