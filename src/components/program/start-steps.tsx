"use client";

import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/text";
import type { Athlete, Exercise, Program } from "@/lib/domain/types";
import { prescribe, type ProgramState, type SlotKey } from "@/lib/engine/engine";
import { formatLoad } from "@/lib/format";
import type { StartInput } from "@/lib/program/start";

export function WeightsStep({
  inputs,
  values,
  onChange,
  exercises,
  dataLabel,
  onBack,
  onContinue,
}: {
  inputs: StartInput[];
  values: Partial<Record<SlotKey, string>>;
  onChange: (values: Partial<Record<SlotKey, string>>) => void;
  exercises: Map<string, Exercise>;
  dataLabel: string;
  onBack: () => void;
  onContinue: () => void;
}) {
  const valid = (i: StartInput) => {
    const v = values[i.key]?.trim();
    return !!v && Number.isFinite(Number(v)) && (i.bodyweight ? Number(v) >= 0 : Number(v) > 0);
  };
  const missing = inputs.filter((i) => !valid(i)).length;
  const suggested = inputs.filter((i) => i.suggestion !== null).length;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader title="Starting weights" meta={`Suggestions from ${dataLabel}`} />
        <p className="m-0 px-5 pt-4 text-base text-fg-secondary">
          {suggested
            ? "Suggestions are set deliberately light, about 90% of what your log says you can do, so week 1 builds momentum. Change any of them."
            : "Your log has no recent sets of these lifts. Enter weights you can do for every rep with a little left in the tank."}
        </p>
        <ul className="m-0 flex list-none flex-col p-0">
          {inputs.map((input) => (
            <li key={input.key} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-border px-5 py-4 last:border-b-0">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-md font-semibold">
                  <span className="font-mono font-medium text-muted">{input.tier} · </span>
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
                  aria-label={`${input.field === "trainingMax" ? "Training max" : "Starting weight"} for ${input.tier} ${exercises.get(input.exerciseId)?.name}`}
                  className="num h-11 w-24 rounded-sm border border-border-input bg-bg px-3 text-right text-md text-fg"
                />
                <span className="font-mono">lb</span>
              </label>
            </li>
          ))}
        </ul>
      </Card>
      <div className="flex flex-wrap items-center justify-end gap-3">
        {missing ? <span className="text-sm text-muted">{missing} still empty</span> : null}
        <Button variant="secondary" onClick={onBack}>
          Back to review
        </Button>
        <Button variant="primary" onClick={onContinue} disabled={missing > 0}>
          Preview week 1
        </Button>
      </div>
    </div>
  );
}

export function PreviewStep({
  program,
  state,
  exercises,
  athlete,
  saving,
  onBack,
  onApprove,
}: {
  program: Program;
  state: ProgramState;
  exercises: Map<string, Exercise>;
  athlete: Athlete;
  saving: boolean;
  onBack: () => void;
  onApprove: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <p className="m-0 text-md text-fg-secondary">
        Your first rotation, as the rule engine will prescribe it. After each session it applies your {program.rules.length} confirmed rules to decide the next one.
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {program.days.map((day) => (
          <Card key={day.id}>
            <CardHeader title={`Day ${day.name}`} meta={`${day.slots.length} exercises`} />
            <ul className="m-0 flex list-none flex-col p-0">
              {prescribe(program, day, state, athlete).map((p) => {
                const top = p.sets?.at(-1);
                return (
                  <li key={p.key} className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-baseline gap-2 border-b border-border px-5 py-3 last:border-b-0">
                    <span className="font-mono text-xs text-muted">{p.slot.tier}</span>
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
      <Card className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div className="flex flex-col gap-1">
          <Eyebrow>Ready</Eyebrow>
          <span className="text-md">Approving makes this your active program in Plan and Train, in this browser.</span>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onBack} disabled={saving}>
            Back
          </Button>
          <Button variant="primary" onClick={onApprove} disabled={saving}>
            {saving ? "Saving…" : "Approve program"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
