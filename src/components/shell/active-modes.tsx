"use client";

import { usePathname } from "next/navigation";
import { ModeTabBar, ModeTabs, activeMode } from "./modes";

// usePathname can suspend under Cache Components on routes with unknown
// dynamic params, so callers wrap these in <Suspense> with the inactive version.

export function ActiveModeTabs() {
  return <ModeTabs active={activeMode(usePathname())} />;
}

export function ActiveModeTabBar() {
  return <ModeTabBar active={activeMode(usePathname())} />;
}
