"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatScheme } from "@/lib/domain/describe";
import type { Rule, SetScheme } from "@/lib/domain/types";

/** "5x3+, 6x2+, 10x1+" → schemes. Returns null if anything doesn't parse. */
export function parseSchemes(text: string): SetScheme[] | null {
  const parts = text.split(/[,→>]+/).map((p) => p.trim()).filter(Boolean);
  const out: SetScheme[] = [];
  for (const p of parts) {
    const m = p.match(/^(\d+)\s*[x×]\s*(\d+)\s*(\+)?$/i);
    if (!m) return null;
    out.push({ sets: Number(m[1]), reps: Number(m[2]), amrapLast: !!m[3] });
  }
  return out.length ? out : null;
}

function Num({ label, value, onChange, suffix }: { label: string; value: string; onChange: (v: string) => void; suffix?: string }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      <span className="flex items-center gap-2">
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="num h-10 w-24 rounded-sm border border-border bg-bg px-3 text-base text-fg"
        />
        {suffix ? <span className="font-mono text-sm text-muted">{suffix}</span> : null}
      </span>
    </label>
  );
}

/** Edits a rule's numbers. Saving builds a new rule only if everything parses. */
export function RuleEditor({ rule, onSave, onCancel }: { rule: Rule; onSave: (rule: Rule) => void; onCancel: () => void }) {
  const inc = "increment" in rule ? rule.increment : null;
  const [upper, setUpper] = useState(String(inc?.upper ?? ""));
  const [lower, setLower] = useState(String(inc?.lower ?? ""));
  const [repTarget, setRepTarget] = useState(rule.kind === "amrap-threshold" ? String(rule.repTarget) : "");
  const [min, setMin] = useState(rule.kind === "double-progression" ? String(rule.repRange.min) : "");
  const [max, setMax] = useState(rule.kind === "double-progression" ? String(rule.repRange.max) : "");
  const [stages, setStages] = useState(rule.kind === "stage-on-failure" ? rule.stages.map(formatScheme).join(", ") : "");
  const [resetTo, setResetTo] = useState(rule.kind === "stage-on-failure" ? formatScheme(rule.reset.to) : "");
  const [percent, setPercent] = useState(rule.kind === "stage-on-failure" ? String(Math.round(rule.reset.percent * 100)) : "");
  const [percentOf, setPercentOf] = useState(rule.kind === "stage-on-failure" ? rule.reset.percentOf : "last-weight");
  const [error, setError] = useState<string | null>(null);

  const n = (v: string) => (v.trim() === "" ? NaN : Number(v));
  const pos = (v: number) => Number.isFinite(v) && v > 0;

  function save() {
    const increment = { upper: n(upper), lower: n(lower) };
    switch (rule.kind) {
      case "linear":
      case "percentage-cycle":
        if (!pos(increment.upper) || !pos(increment.lower)) return setError("Both weight jumps need to be positive numbers.");
        return onSave({ ...rule, increment });
      case "amrap-threshold":
        if (!pos(increment.upper) || !pos(increment.lower) || !pos(n(repTarget))) return setError("Fill in the jumps and the rep target.");
        return onSave({ ...rule, increment, repTarget: n(repTarget) });
      case "double-progression":
        if (!pos(increment.upper) || !pos(increment.lower) || !pos(n(min)) || !(n(max) > n(min))) return setError("Fill in the jumps, and a rep range where the top is above the bottom.");
        return onSave({ ...rule, increment, repRange: { min: n(min), max: n(max) } });
      case "stage-on-failure": {
        const parsed = parseSchemes(stages);
        const to = parseSchemes(resetTo)?.[0];
        const p = n(percent) / 100;
        if (!parsed || parsed.length < 2) return setError("Write at least two stages, like 5x3+, 6x2+, 10x1+.");
        if (!to) return setError("Write the reset scheme, like 5x3+.");
        if (!(p > 0 && p <= 1)) return setError("The reset percentage should be between 1 and 100.");
        return onSave({ ...rule, stages: parsed, reset: { to, percent: p, percentOf: percentOf as "last-weight" | "retest-5rm" } });
      }
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-md border border-border bg-surface p-4">
      {rule.kind !== "stage-on-failure" ? (
        <div className="flex flex-wrap gap-4">
          <Num label="Lower-body jump" value={lower} onChange={setLower} suffix="lb" />
          <Num label="Upper-body jump" value={upper} onChange={setUpper} suffix="lb" />
          {rule.kind === "amrap-threshold" ? <Num label="Last-set target" value={repTarget} onChange={setRepTarget} suffix="reps" /> : null}
          {rule.kind === "double-progression" ? (
            <>
              <Num label="Range from" value={min} onChange={setMin} suffix="reps" />
              <Num label="to" value={max} onChange={setMax} suffix="reps" />
            </>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Stages, in order
            <input value={stages} onChange={(e) => setStages(e.target.value)} className="num h-10 rounded-sm border border-border bg-bg px-3 text-base text-fg" />
          </label>
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Then restart with
              <input value={resetTo} onChange={(e) => setResetTo(e.target.value)} className="num h-10 w-28 rounded-sm border border-border bg-bg px-3 text-base text-fg" />
            </label>
            <Num label="at" value={percent} onChange={setPercent} suffix="%" />
            <label className="flex flex-col gap-1 text-sm font-medium">
              of
              <select value={percentOf} onChange={(e) => setPercentOf(e.target.value as typeof percentOf)} className="h-10 rounded-sm border border-border bg-bg px-2 text-base text-fg">
                <option value="last-weight">the last weight</option>
                <option value="retest-5rm">a retested 5RM</option>
              </select>
            </label>
          </div>
        </div>
      )}
      {rule.kind === "percentage-cycle" ? <p className="m-0 text-sm text-muted">Weekly percentages can’t be edited here yet.</p> : null}
      {error ? (
        <p role="alert" className="m-0 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button variant="ink" size="sm" onClick={save}>
          Save &amp; confirm
        </Button>
        <Button variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
