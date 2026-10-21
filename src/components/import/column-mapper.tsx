"use client";

import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { isComplete, type ColumnMap } from "@/lib/import/formats";

const FIELDS: Array<{ key: keyof ColumnMap; label: string; required: boolean }> = [
  { key: "date", label: "Date", required: true },
  { key: "exercise", label: "Exercise name", required: true },
  { key: "weight", label: "Weight", required: true },
  { key: "reps", label: "Reps", required: true },
  { key: "workout", label: "Workout name", required: false },
  { key: "setOrder", label: "Set number", required: false },
];

/** For exports we don't recognize: confirm which column is which. */
export function ColumnMapper({
  header,
  sample,
  map,
  onChange,
  onBack,
  onContinue,
}: {
  header: string[];
  sample: string[][];
  map: Partial<ColumnMap>;
  onChange: (map: Partial<ColumnMap>) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader title="Which column is which?" meta="We didn’t recognize this export" />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          {FIELDS.map((field) => (
            <label key={field.key} className="flex flex-col gap-1.5 text-base font-medium">
              <span>
                {field.label}
                {field.required ? null : <span className="font-normal text-muted"> · optional</span>}
              </span>
              <select
                value={map[field.key] ?? ""}
                onChange={(e) => onChange({ ...map, [field.key]: e.target.value === "" ? undefined : Number(e.target.value) })}
                className="h-11 rounded-sm border border-border-input bg-bg px-3 text-base text-fg"
              >
                <option value="">{field.required ? "Choose a column" : "None"}</option>
                {header.map((h, i) => (
                  <option key={i} value={i}>
                    {h || `Column ${i + 1}`}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="First rows" meta={`${header.length} columns`} />
        <div className="overflow-x-auto p-5">
          <table className="num w-full border-collapse text-sm">
            <thead>
              <tr>
                {header.map((h, i) => (
                  <th key={i} scope="col" className="border-b border-border pr-4 pb-2 text-left font-medium whitespace-nowrap text-muted">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sample.map((row, r) => (
                <tr key={r}>
                  {header.map((_, i) => (
                    <td key={i} className="border-b border-border py-2 pr-4 whitespace-nowrap">
                      {row[i]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={onBack}>
          Choose another file
        </Button>
        <Button variant="primary" onClick={onContinue} disabled={!isComplete(map)}>
          Continue
        </Button>
      </div>
    </div>
  );
}
