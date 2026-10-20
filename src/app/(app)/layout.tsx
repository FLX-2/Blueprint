import { Suspense } from "react";
import { ActiveModeTabBar } from "@/components/shell/active-modes";
import { ModeTabBar } from "@/components/shell/modes";
import { TopNav } from "@/components/shell/top-nav";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="bg-drafting min-h-screen">
      <TopNav />
      <main className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 pt-7 pb-28 md:px-8 md:pb-14">
        {children}
      </main>
      <Suspense fallback={<ModeTabBar active={null} />}>
        <ActiveModeTabBar />
      </Suspense>
    </div>
  );
}
