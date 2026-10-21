"use client";

import Link from "next/link";
import { useEffect } from "react";

/** Gym mode or the summary crashed. The session in progress is saved after every set, so it's still there. */
export default function FocusError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main role="alert" className="gym flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="m-0 font-display text-3xl font-medium">Something went wrong.</h1>
      <p className="m-0 max-w-[360px] text-base text-gym-muted">Every set you logged is saved on this phone. Try again to pick up where you were.</p>
      <button type="button" onClick={() => retry()} className="h-14 w-full max-w-[320px] rounded-xl bg-accent text-md font-semibold text-accent-fg">
        Try again
      </button>
      <Link href="/train" className="font-medium text-gym-muted">
        Back to Train
      </Link>
    </main>
  );
}
