import { cn } from "@/lib/cn";

/**
 * A small trend line. The SVG stretches to its container; strokes stay
 * crisp because they don't scale with it.
 */
export function Sparkline({
  values,
  label,
  className,
}: {
  values: number[];
  /** Describes the trend for screen readers. */
  label: string;
  className?: string;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = 100;
  const h = 32;
  const points = values
    .map((v, i) => `${((i / (values.length - 1)) * w).toFixed(2)},${(h - 2 - ((v - min) / span) * (h - 4)).toFixed(2)}`)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
      className={cn("h-8 w-full", className)}
    >
      <polyline
        points={points}
        fill="none"
        stroke="var(--bp-chart-line)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** Weekly bars, e.g. sets per week. `markFrom` tints bars from that index on. */
export function WeekBars({
  values,
  label,
  markFrom,
  className,
}: {
  values: number[];
  label: string;
  markFrom?: number;
  className?: string;
}) {
  const max = Math.max(...values, 1);
  const slot = 100 / values.length;
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label={label} className={cn("h-16 w-full", className)}>
      {markFrom !== undefined ? (
        <rect x={markFrom * slot} y="0" width={100 - markFrom * slot} height="40" fill="var(--bp-chart-band)" />
      ) : null}
      {values.map((v, i) => {
        const height = (v / max) * 36;
        return (
          <rect
            key={i}
            x={i * slot + slot * 0.18}
            y={38 - height}
            width={slot * 0.64}
            height={height}
            fill="var(--bp-text-muted)"
          />
        );
      })}
      <line x1="0" y1="38" x2="100" y2="38" stroke="var(--bp-chart-grid)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
