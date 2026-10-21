"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { markStarted } from "@/lib/onboarding";

/** A link that also records that the lifter has picked a starting point. */
export function StartLink({ onClick, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      {...props}
      onClick={(e) => {
        markStarted();
        onClick?.(e);
      }}
    />
  );
}
