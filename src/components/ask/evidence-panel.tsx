"use client";

import type { ToolResult } from "@/lib/ask/tools";
import type { IsoDate } from "@/lib/domain/types";
import { formatRange } from "@/lib/ask/tools";

/** The sets behind a claim: rows from the cited tool result, narrowed to the claim's dates. */
export function EvidencePanel({
  result,
  range,
  claim,
  onClose,
}: {
  result: ToolResult;
  range: { from: IsoDate | null; to: IsoDate | null };
  claim: string;
  onClose: () => void;
}) {
  const evidence = result.evidence!;
  const rows = evidence.rows.filter((r) => (!range.from || r.date >= range.from) && (!range.to || r.date <= range.to));
  const shown = rows.length ? rows : evidence.rows;
  const hasThird = shown.some((r) => r.cells[2] !== "");

  return (
    <aside aria-label="Evidence" className="flex max-h-[calc(100dvh-140px)] w-full min-w-0 flex-col rounded-lg border border-border bg-surface lg:sticky lg:top-24">
      <div className="flex items-start justify-between gap-3 border-b border-border py-3.5 pr-2 pl-5">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-mono text-xs tracking-[0.08em] text-muted uppercase">Evidence</span>
          <span className="text-md font-semibold">{evidence.title}</span>
          <span className="text-sm text-fg-secondary">“{claim.trim()}”</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close evidence"
          className="flex size-10 shrink-0 items-center justify-center rounded-sm text-fg hover:bg-surface-raised"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-5 py-3">
        {range.from || range.to ? (
          <p className="m-0 mb-2 font-mono text-xs text-muted">
            {formatRange(range.from ?? shown[0].date, range.to ?? shown.at(-1)!.date)} · {shown.length} rows
          </p>
        ) : (
          <p className="m-0 mb-2 font-mono text-xs text-muted">{shown.length} rows</p>
        )}
        <table className="num w-full border-collapse text-sm">
          <thead>
            <tr className="text-muted">
              <th scope="col" className="border-b border-border pb-2 text-left font-medium">{evidence.columns[0]}</th>
              <th scope="col" className="border-b border-border pb-2 text-right font-medium">{evidence.columns[1]}</th>
              {hasThird ? <th scope="col" className="border-b border-border pb-2 text-right font-medium">{evidence.columns[2]}</th> : null}
            </tr>
          </thead>
          <tbody>
            {shown.map((row, i) => (
              <tr key={`${row.date}-${i}`}>
                <td className="border-b border-border py-2">{row.cells[0]}</td>
                <td className="border-b border-border py-2 text-right">{row.cells[1]}</td>
                {hasThird ? <td className="border-b border-border py-2 text-right text-fg-secondary">{row.cells[2]}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
        {evidence.note ? <p className="ai-reasoning m-0 mt-3 text-md">{evidence.note}</p> : null}
      </div>
      <div className="border-t border-dashed border-border px-5 py-3 font-mono text-xs text-muted">Computed from your log by code</div>
    </aside>
  );
}
