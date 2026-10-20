import type { ChartData } from "@/lib/ask/tools";
import { formatShortDate } from "@/lib/format";
import type { IsoDate } from "@/lib/domain/types";

type Range = { from: IsoDate | null; to: IsoDate | null };

const W = 400;
const H = 150;
const PAD_TOP = 22;
const PAD_BOTTOM = 8;

/** Index range of points inside [from, to]; null if none. */
function indexRange(points: ChartData["points"], range: Range) {
  const from = range.from ?? points[0].x;
  const to = range.to ?? points.at(-1)!.x;
  const first = points.findIndex((p) => p.x >= from);
  let last = -1;
  for (let i = points.length - 1; i >= 0; i--) if (points[i].x <= to) { last = i; break; }
  return first === -1 || last === -1 || last < first ? null : { first, last };
}

/**
 * A chart drawn only from a tool result's computed points. The AI picks the
 * result and the stretch to highlight (amber); a selected claim outlines the
 * dates it refers to.
 */
export function AnswerChart({
  chart,
  title,
  highlight,
  focus,
}: {
  chart: ChartData;
  title: string;
  highlight: (Range & { label: string }) | null;
  focus: Range | null;
}) {
  const pts = chart.points;
  if (pts.length < 2) return null;
  const values = pts.map((p) => p.y);
  const max = Math.max(...values);
  const min = chart.kind === "bars" ? 0 : Math.min(...values);
  const span = max - min || 1;
  const slot = W / pts.length;
  const x = (i: number) => (chart.kind === "bars" ? i * slot + slot / 2 : (i / (pts.length - 1)) * W);
  const y = (v: number) => PAD_TOP + (1 - (v - min) / span) * (H - PAD_TOP - PAD_BOTTOM);
  const bandFor = (r: Range) => {
    const ix = indexRange(pts, r);
    if (!ix) return null;
    const left = chart.kind === "bars" ? ix.first * slot : x(ix.first);
    const right = chart.kind === "bars" ? (ix.last + 1) * slot : x(ix.last);
    return { left, width: Math.max(right - left, 2) };
  };
  const hl = highlight ? bandFor(highlight) : null;
  const fc = focus ? bandFor(focus) : null;
  const mid = Math.floor(pts.length / 2);

  return (
    <figure className="m-0 flex flex-col gap-2">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-base font-semibold">{title}</span>
        <span className="font-mono text-xs text-muted">
          {chart.kind === "line" ? `${Math.round(min)}–${Math.round(max)} ${chart.unit}` : `max ${max} ${chart.unit}`}
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${chart.label}, ${formatShortDate(pts[0].x)} to ${formatShortDate(pts.at(-1)!.x)}: from ${values[0]} to ${values.at(-1)} ${chart.unit}, highest ${max}.`}
        className={chart.kind === "line" ? "h-48 w-full" : "h-24 w-full"}
      >
        {hl ? (
          <>
            <rect x={hl.left} y={PAD_TOP - 4} width={hl.width} height={H - PAD_TOP + 4} fill="var(--bp-ai-wash)" />
            <line x1={hl.left} y1="8" x2={hl.left + hl.width} y2="8" stroke="var(--bp-ai)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            <line x1={hl.left} y1="3" x2={hl.left} y2="13" stroke="var(--bp-ai)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            <line x1={hl.left + hl.width} y1="3" x2={hl.left + hl.width} y2="13" stroke="var(--bp-ai)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          </>
        ) : null}
        {chart.kind === "line" ? (
          <polyline
            points={pts.map((p, i) => `${x(i)},${y(p.y)}`).join(" ")}
            fill="none"
            stroke="var(--bp-chart-line)"
            strokeWidth="2"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ) : (
          <path
            d={pts.map((p, i) => `M${i * slot + slot * 0.18} ${y(p.y)}V${H - PAD_BOTTOM}h${slot * 0.64}V${y(p.y)}Z`).join(" ")}
            fill="var(--bp-text-muted)"
          />
        )}
        <line x1="0" y1={H - PAD_BOTTOM} x2={W} y2={H - PAD_BOTTOM} stroke="var(--bp-chart-grid)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        {fc ? (
          <rect
            x={fc.left}
            y={PAD_TOP - 4}
            width={fc.width}
            height={H - PAD_TOP - PAD_BOTTOM + 4}
            fill="none"
            stroke="var(--bp-text)"
            strokeWidth="1.5"
            strokeDasharray="4 3"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>
      <div className="flex justify-between font-mono text-xs text-muted">
        <span>{formatShortDate(pts[0].x)}</span>
        {highlight && hl ? <span className="text-ai-text">{highlight.label}</span> : <span>{formatShortDate(pts[mid].x)}</span>}
        <span>{formatShortDate(pts.at(-1)!.x)}</span>
      </div>
    </figure>
  );
}
