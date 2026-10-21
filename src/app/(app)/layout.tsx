import { Suspense, ViewTransition } from "react";
import { OfflineBanner } from "@/components/offline";
import { SampleBar } from "@/components/onboarding/sample-bar";
import { ActiveModeTabBar } from "@/components/shell/active-modes";
import { ModeTabBar } from "@/components/shell/modes";
import { TopNav } from "@/components/shell/top-nav";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="bg-drafting min-h-screen">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-fg font-semibold text-inverse no-underline focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:px-4 focus:py-2.5"
      >
        Skip to content
      </a>
      <OfflineBanner />
      <TopNav />
      <SampleBar />
      <main id="main" tabIndex={-1} className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 pt-7 pb-28 md:px-8 md:pb-14">
        {/* Page changes crossfade; see the view transition styles in tokens.css. */}
        <ViewTransition update="page" default="none">
          <div className="flex flex-col gap-6">{children}</div>
        </ViewTransition>
      </main>
      <Suspense fallback={<ModeTabBar active={null} />}>
        <ActiveModeTabBar />
      </Suspense>
    </div>
  );
}
