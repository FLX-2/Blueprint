"use client";

import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";
import { useOnboardingFlags } from "@/lib/onboarding";
import { useActiveProgram } from "@/lib/program/store";

/** While the sample program is active, say so on every screen, with the way out. */
export function SampleBar() {
  const program = useActiveProgram();
  const { hydrated } = useOnboardingFlags();
  if (!hydrated || program.status !== "ready" || program.active.kind !== "sample") return null;

  return (
    <aside aria-label="Sample data" className="enter-fade border-b border-border bg-surface-raised">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 md:px-8">
        <p className="m-0 flex items-center gap-2 text-sm text-fg-secondary">
          <span className="size-1.5 shrink-0 rounded-full bg-fg-secondary" aria-hidden="true" />
          <span>
            <span className="font-semibold text-fg">Sample data.</span>
            <span className="hidden sm:inline"> You’re exploring a sample lifter’s program and 18 months of history.</span>
          </span>
        </p>
        <Link href="/plan/import" className="group flex items-center gap-1.5 text-sm font-medium text-link no-underline hover:text-fg">
          Use your own program
          <ArrowRightIcon width={14} height={14} className="transition-transform duration-200 ease-standard group-hover:translate-x-0.5" />
        </Link>
      </div>
    </aside>
  );
}
