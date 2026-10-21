"use client";

import { useRouter } from "next/navigation";
import { Fragment, type ReactNode } from "react";

/**
 * Next.js keeps recently visited pages alive (React <Activity>), so a flow
 * left on step 3 used to reopen on step 3. One-off flows (importing a
 * program or history, bending the week) should start fresh when you click
 * into them again, but still come back as you left them on browser back and
 * forward. bfcacheId changes on push/replace navigations only.
 */
export function FreshOnVisit({ children }: { children: ReactNode }) {
  const { bfcacheId } = useRouter();
  return <Fragment key={bfcacheId}>{children}</Fragment>;
}
