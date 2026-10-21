import Link from "next/link";
import { ViewTransition, type ComponentType, type SVGProps } from "react";
import { PlanIcon, ReviewIcon, TrainIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

export type Mode = {
  href: "/plan" | "/train" | "/review";
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
};

export const MODES: Mode[] = [
  { href: "/plan", label: "Plan", Icon: PlanIcon },
  { href: "/train", label: "Train", Icon: TrainIcon },
  { href: "/review", label: "Review", Icon: ReviewIcon },
];

export function activeMode(pathname: string | null) {
  return MODES.find((m) => pathname === m.href || pathname?.startsWith(`${m.href}/`))?.href ?? null;
}

/** Desktop segmented control. `active` is null in the prerendered fallback. */
export function ModeTabs({ active }: { active: Mode["href"] | null }) {
  return (
    <div className="hidden gap-1 rounded-md bg-surface-raised p-1 md:flex">
      {MODES.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          aria-current={active === href ? "page" : undefined}
          className={cn(
            "relative flex h-9 items-center rounded-sm px-4 text-base no-underline transition-colors duration-150 focus-visible:outline-offset-0",
            active === href ? "font-semibold text-fg" : "font-medium text-muted hover:text-fg",
          )}
        >
          {active === href ? (
            // One pill, named, so it glides to the new tab when the page changes.
            <ViewTransition name="mode-pill">
              <span className="absolute inset-0 rounded-sm border border-border bg-surface" aria-hidden="true" />
            </ViewTransition>
          ) : null}
          {/* Its own layer above the pill, so the text never disappears while the pill glides. */}
          <span className="mode-label relative" style={{ viewTransitionName: `mode-label-${label.toLowerCase()}` }}>
            {label}
          </span>
        </Link>
      ))}
    </div>
  );
}

/** Phone tab bar, fixed to the bottom of the screen. */
export function ModeTabBar({ active }: { active: Mode["href"] | null }) {
  return (
    <nav
      aria-label="Modes"
      className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-3 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {MODES.map(({ href, label, Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={active === href ? "page" : undefined}
          className={cn(
            "flex h-16 flex-col items-center justify-center gap-1 text-xs no-underline",
            active === href ? "font-semibold text-fg" : "font-medium text-muted",
          )}
        >
          <Icon />
          {label}
        </Link>
      ))}
    </nav>
  );
}
