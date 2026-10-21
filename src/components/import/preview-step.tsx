"use client";

import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import type { Unit } from "@/lib/domain/types";
import { formatLongDate } from "@/lib/format";
import type { ImportFormat } from "@/lib/import/formats";
import { SKIP_LABELS, type ImportSummary, type SkipReason } from "@/lib/import/rows";
import { StepFooter } from "@/components/ui/flow";

const FORMAT_LABELS: Record<ImportFormat, string> = { strong: "Strong export", hevy: "Hevy export", generic: "Custom columns" };

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 bg-surface px-5 py-4">
      <Eyebrow>{label}</Eyebrow>
      <span className="num text-2xl font-medium">{value}</span>
    </div>
  );
}

export function PreviewStep({
  fileName,
  format,
  summary,
  skipped,
  unit,
  unitKnown,
  onUnit,
  onBack,
  onContinue,
}: {
  fileName: string;
  format: ImportFormat;
  summary: ImportSummary;
  skipped: Record<SkipReason, number>;
  unit: Unit;
  unitKnown: boolean;
  onUnit: (unit: Unit) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const skippedRows = (Object.entries(skipped) as Array<[SkipReason, number]>).filter(([, n]) => n > 0);
  const empty = summary.sets === 0;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader title={fileName} meta={FORMAT_LABELS[format]} />
        <div className="grid grid-cols-2 gap-px bg-border lg:grid-cols-4">
          <Stat label="Sessions" value={summary.sessions.toLocaleString("en-US")} />
          <Stat label="Working sets" value={summary.sets.toLocaleString("en-US")} />
          <Stat label="Exercise names" value={String(summary.names.length)} />
          <Stat
            label="Dates"
            value={summary.firstDate && summary.lastDate ? `${summary.firstDate.slice(0, 4)}–${summary.lastDate.slice(0, 4)}` : "—"}
          />
        </div>
        <div className="flex flex-col gap-3 px-5 py-4 text-base text-fg-secondary">
          {summary.firstDate && summary.lastDate ? (
            <span>
              From {formatLongDate(summary.firstDate)} to {formatLongDate(summary.lastDate)}.
            </span>
          ) : null}
          {skippedRows.length ? (
            <span>
              Left out:{" "}
              {skippedRows.map(([reason, n], i) => (
                <span key={reason}>
                  {i ? ", " : ""}
                  <span className="num">{n}</span> {SKIP_LABELS[reason]}
                </span>
              ))}
              .
            </span>
          ) : null}
        </div>
      </Card>

      {!unitKnown ? (
        <Card className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
          <span className="text-md font-medium">Weights in this file are in</span>
          <div role="group" aria-label="Weight unit" className="inline-flex gap-1 rounded-md bg-surface-raised p-1">
            {(["lb", "kg"] as const).map((u) => (
              <button
                key={u}
                type="button"
                aria-pressed={unit === u}
                onClick={() => onUnit(u)}
                className={cn(
                  "h-9 rounded-sm px-4 font-mono text-base",
                  unit === u ? "border border-border bg-surface text-fg" : "text-muted hover:text-fg",
                )}
              >
                {u}
              </button>
            ))}
          </div>
        </Card>
      ) : null}

      {empty ? (
        <p role="alert" className="m-0 rounded-md border border-danger bg-danger-wash px-4 py-3 text-base">
          No working sets were found. Check that the right columns are mapped.
        </p>
      ) : null}

      <StepFooter status={empty ? "No working sets found." : `${summary.names.length} exercise names to match next.`}>
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button variant="primary" onClick={onContinue} disabled={empty}>
          Clean up {summary.names.length} exercise names
        </Button>
      </StepFooter>
    </div>
  );
}
