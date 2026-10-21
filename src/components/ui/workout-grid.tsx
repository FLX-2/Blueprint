import type { CSSProperties, ReactNode } from "react";

/**
 * A grid of workouts with hairlines between them, as many columns as there
 * are workouts (up to `max`), so two workouts fill the width instead of
 * leaving empty columns. Cells draw their own right and bottom lines; the
 * outer edge ones are clipped, so a half-filled last row stays clean.
 */
export const GRID_CELL = "border-r border-b border-border bg-surface";

export function WorkoutGrid({ count, max, as = "ol", children }: { count: number; max: number; as?: "ol" | "div"; children: ReactNode }) {
  const Tag = as;
  const style = { "--cols-sm": Math.min(count, 2), "--cols-xl": Math.min(count, max) } as CSSProperties;
  return (
    <div className="overflow-hidden">
      <Tag
        style={style}
        className="-mr-px -mb-px grid list-none grid-cols-1 p-0 m-0 sm:grid-cols-[repeat(var(--cols-sm),minmax(0,1fr))] xl:grid-cols-[repeat(var(--cols-xl),minmax(0,1fr))]"
      >
        {children}
      </Tag>
    </div>
  );
}
