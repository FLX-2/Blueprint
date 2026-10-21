"use client";

import { Card, CardHeader } from "@/components/ui/card";
import type { Athlete, Exercise, Program } from "@/lib/domain/types";
import { prescribe, type ProgramState, type SlotKey } from "@/lib/engine/engine";
import { formatLoad } from "@/lib/format";
import type { StartInput } from "@/lib/program/start";
import { DayTitle, TierLabel } from "@/components/ui/terms";
import { TIER_NAMES } from "@/lib/domain/describe";

/** How many starting weights are still empty or not a number. */
export function missingWeights(inputs: StartInput[], values: Partial<Record<SlotKey, string>>) {
  return inputs.filter((i) => {
    const v = values[i.key]?.trim();
    return !(!!v && Number.isFinite(Number(v)) && (i.bodyweight ? Number(v) >= 0 : Number(v) > 0));
  }).length;
}

export function WeightsStep({
  inputs,
  values,
  onChange,
  exercises,
  dataLabel,
}: {
  inputs: StartInput[];
  values: Partial<Record<SlotKey, string>>;
  onChange: (values: Partial<Record<SlotKey, string>>) => void;
  exercises: Map<string, Exercise>;
  dataLabel: string;
}) {
  const suggested = inputs.filter((i) => i.suggestion !== null).length;

  return (
    <>
      <Card>
        <CardHeader title={suggested ? "Suggested from your log" : "Your starting weights"} meta={`From ${dataLabel}`} />
        <ul className="m-0 flex list-none flex-col p-0">
          {inputs.map((input) => (
            <li key={input.key} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-border px-5 py-4 last:border-b-0">
              <div className="flex min-w-0 flex-col gap-1">
                <TierLabel tier={input.tier} />
                <span className="text-md font-semibold">
                  {exercises.get(input.exerciseId)?.name ?? input.exerciseId}{" "}
                  <span className="font-mono text-sm font-medium text-fg-secondary">{input.scheme}</span>
                </span>
                <span className="text-sm text-muted">{input.basis ?? "No recent sets in your log."}</span>
              </div>
              <label className="flex items-center gap-2 text-sm text-muted">
                <span>{input.field === "trainingMax" ? "Training max" : input.bodyweight ? "Added weight" : "Weight"}</span>
                <input
                  inputMode="decimal"
                  value={values[input.key] ?? ""}
                  onChange={(e) => onChange({ ...values, [input.key]: e.target.value })}
                  aria-label={`${input.field === "trainingMax" ? "Training max" : "Starting weight"} for ${exercises.get(input.exerciseId)?.name} (${TIER_NAMES[input.tier].one.toLowerCase()})`}
                  className="num h-11 w-24 rounded-sm border border-border-input bg-bg px-3 text-right text-md text-fg"
                />
                <span className="font-mono">lb</span>
              </label>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

export function PreviewStep({
  program,
  state,
  exercises,
  athlete,
}: {
  program: Program;
  state: ProgramState;
  exercises: Map<string, Exercise>;
  athlete: Athlete;
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {program.days.map((day) => (
          <Card key={day.id}>
            <CardHeader title={<DayTitle program={program} day={day} />} meta={`${day.slots.length} exercises`} />
            <ul className="m-0 flex list-none flex-col p-0">
              {prescribe(program, day, state, athlete).map((p) => {
                const top = p.sets?.at(-1);
                return (
                  <li key={p.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2 gap-y-1 border-b border-border px-5 py-3 last:border-b-0">
                    <TierLabel tier={p.slot.tier} className="col-span-2" />
                    <span className="text-base font-medium">
                      {exercises.get(p.slot.exerciseId)?.name}{" "}
                      <span className="font-mono text-sm text-fg-secondary">{p.scheme}</span>
                    </span>
                    <span className="num text-md">{top ? formatLoad(top.weight, exercises.get(p.slot.exerciseId)?.equipment === "bodyweight") : "—"}</span>
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
      </div>
    </>
  );
}
