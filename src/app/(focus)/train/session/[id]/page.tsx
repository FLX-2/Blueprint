import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeftIcon } from "@/components/icons";
import { todaysSession } from "@/lib/engine/today";

export const metadata: Metadata = { title: "Session" };

// Only the demo session exists until sessions are created from Train (F2),
// so the page doesn't read `id` yet.
export function generateStaticParams() {
  return [{ id: "demo" }];
}

export default function SessionPage() {
  const { day, items } = todaysSession();
  const first = items[0];
  const sets = first.sets ?? [];
  const done = Math.min(2, Math.max(sets.length - 1, 0));
  const current = sets[done];

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
            {first.exercise.name.toUpperCase()} · {first.slot.tier}
          </span>
          <span>
            SET {done + 1}/{sets.length}
          </span>
        </div>
        <div className="flex gap-1.5" aria-hidden="true">
          {sets.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full ${i < done ? "bg-gym-text" : i === done ? "bg-accent" : "bg-gym-track"}`} />
          ))}
        </div>

        {current ? (
          <>
            <p className="m-0 mt-6 flex items-baseline gap-2">
              <span className="font-display text-gym font-medium tracking-[-0.03em]">{current.weight}</span>
              <span className="font-mono text-md text-gym-muted">lb</span>
            </p>
            <p className="m-0 font-mono text-2xl font-medium">
              × {current.reps}
              {current.amrap ? "+" : ""} reps
            </p>
            {first.plates?.perSide.length ? (
              <p className="m-0 font-mono text-sm text-gym-muted">Per side: {first.plates.perSide.join(" · ")}</p>
            ) : null}
            <p className="m-0 font-mono text-sm text-gym-muted">
              {first.scheme} · rest 02:30{first.because ? ` · ${first.because.message}` : ""}
            </p>
          </>
        ) : (
          <p className="m-0 mt-6 text-lg">Set a starting weight for {first.exercise.name} to begin.</p>
        )}

        <button type="button" disabled className="mt-auto h-15 rounded-xl bg-accent text-lg font-semibold text-accent-fg disabled:opacity-60">
          Log set
        </button>
        <p className="m-0 text-center font-mono text-xs text-gym-muted">Logging arrives with gym mode (F2)</p>
      </main>
    </div>
  );
}
