import Link from "next/link";
import { Suspense } from "react";
import { athlete } from "@/data/seed";
import { ActiveModeTabs } from "./active-modes";
import { AskBar } from "./ask-bar";
import { ModeTabs } from "./modes";

export function TopNav() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface" style={{ viewTransitionName: "site-header" }}>
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 md:px-6">
        <Link href="/plan" className="font-display text-2xl font-semibold tracking-[-0.01em] text-fg no-underline">
          Blueprint
        </Link>
        <Suspense fallback={<ModeTabs active={null} />}>
          <ActiveModeTabs />
        </Suspense>
        <AskBar />
        <Link
          href="/settings"
          className="flex size-9 items-center justify-center rounded-full border border-border bg-surface-raised text-sm font-semibold text-fg no-underline"
        >
          {athlete.initials}
          <span className="sr-only">, settings and account</span>
        </Link>
      </div>
    </header>
  );
}
