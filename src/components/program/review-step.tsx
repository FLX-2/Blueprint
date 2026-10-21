"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Eyebrow, Tag } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import { describeRule, formatScheme, ruleTitle } from "@/lib/domain/describe";
import type { Exercise } from "@/lib/domain/types";
import { matchName } from "@/lib/import/match";
import { draftIssues, type DraftRule, type DraftSlot, type ProgramDraft } from "@/lib/program/convert";
import { segmentSource, type Mark } from "@/lib/program/source-segments";
import { RuleEditor } from "./rule-editor";

export type Selection = { kind: "slot" | "rule"; id: string } | null;

const pct = (n: number) => `${Math.round(n * 100)}% sure`;
const customId = (name: string) => `custom-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

function SourcePane({ draft, selected }: { draft: ProgramDraft; selected: Selection }) {
  const marks: Mark[] = [
    ...draft.rules.flatMap((r) => (r.span ? [{ id: r.id, span: r.span, flagged: !r.confirmed }] : [])),
    ...draft.days.flatMap((d) => d.slots.flatMap((s) => (s.span ? [{ id: s.id, span: s.span, flagged: !s.confirmed }] : []))),
  ];
  const segments = segmentSource(draft.sourceText, marks, selected?.id ?? null);

  return (
    <Card className="min-w-0 flex-[1_1_380px] lg:sticky lg:top-24">
      <CardHeader title="Source" meta={`pasted text · ${draft.sourceText.length.toLocaleString("en-US")} chars`} />
      <div className="max-h-[70vh] overflow-auto p-6 font-display text-lg leading-[1.7] whitespace-pre-wrap text-fg-secondary">
        {segments.map((seg, i) =>
          seg.mark ? (
            <span
              key={i}
              className={cn(
                "text-fg",
                seg.mark.flagged ? "rounded-xs bg-ai-mark border-b-[1.5px] border-dashed border-ai" : "border-b-[1.5px] border-dashed border-ai",
                seg.selected && "outline-2 outline-offset-2 outline-ai rounded-xs",
              )}
            >
              {seg.text}
            </span>
          ) : (
            <span key={i}>{seg.text}</span>
          ),
        )}
      </div>
      <div className="flex flex-wrap gap-5 border-t border-dashed border-border px-5 py-3.5 text-xs text-muted">
        <span className="flex items-center gap-2">
          <span className="h-3 w-7 border-b-[1.5px] border-dashed border-ai bg-ai-mark" aria-hidden="true" />
          Needs your check
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-7 border-b-[1.5px] border-dashed border-ai" aria-hidden="true" />
          Read with high confidence, or confirmed
        </span>
      </div>
    </Card>
  );
}

function SlotRow({
  slot,
  library,
  libraryById,
  selected,
  onSelect,
  onChange,
}: {
  slot: DraftSlot;
  library: Exercise[];
  libraryById: Map<string, Exercise>;
  selected: boolean;
  onSelect: () => void;
  onChange: (slot: DraftSlot) => void;
}) {
  const options = [slot.name, ...slot.alternatives].map((name) => ({ name, match: matchName(name, library) }));
  const resolvedName = slot.exerciseId ? (libraryById.get(slot.exerciseId)?.name ?? slot.name) : null;

  return (
    <div id={`item-${slot.id}`} className={cn("flex scroll-mt-28 flex-col gap-1.5 rounded-sm px-2 py-1.5", selected && "bg-surface-raised")}>
      <div className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-baseline gap-2">
        <span className="font-mono text-xs text-muted">{slot.tier}</span>
        <button type="button" onClick={onSelect} className="min-w-0 truncate text-left text-base font-medium text-fg hover:underline">
          {resolvedName ?? <span className="rounded-xs bg-ai-mark px-1">{[slot.name, ...slot.alternatives].join(" / ")}?</span>}
        </button>
        <span className="font-mono text-sm text-fg-secondary">{formatScheme(slot.scheme)}</span>
      </div>
      {!slot.confirmed ? (
        <div className="flex flex-wrap items-center gap-2 pl-[36px]">
          <select
            aria-label={`Exercise for ${slot.name}`}
            value={slot.exerciseId ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              onChange({ ...slot, exerciseId: v.startsWith("custom:") ? customId(v.slice(7)) : v, confirmed: true });
            }}
            className="h-9 max-w-full rounded-sm border border-border-input bg-bg px-2 text-sm text-fg"
          >
            <option value="">{slot.alternatives.length ? "Pick one…" : "Which exercise?"}</option>
            <optgroup label="From the program">
              {options.map((o) =>
                o.match.exerciseId ? (
                  <option key={o.name} value={o.match.exerciseId}>
                    {libraryById.get(o.match.exerciseId)?.name}
                  </option>
                ) : (
                  <option key={o.name} value={`custom:${o.name}`}>
                    {o.name} (custom)
                  </option>
                ),
              )}
            </optgroup>
            <optgroup label="Library">
              {library.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </optgroup>
          </select>
          {slot.exerciseId ? (
            <Button variant="ink" size="sm" onClick={() => onChange({ ...slot, confirmed: true })}>
              Confirm
            </Button>
          ) : null}
          <span className="font-mono text-xs text-ai-text">{slot.alternatives.length ? "Either/or in the text" : pct(slot.confidence)}</span>
        </div>
      ) : null}
    </div>
  );
}

function RuleCard({
  item,
  selected,
  onSelect,
  onChange,
}: {
  item: DraftRule;
  selected: boolean;
  onSelect: () => void;
  onChange: (item: DraftRule) => void;
}) {
  const [editing, setEditing] = useState(false);
  const runnable = !!item.rule;

  return (
    <li
      id={`item-${item.id}`}
      className={cn(
        "flex scroll-mt-28 flex-col gap-2.5 rounded-md p-4",
        !runnable ? "border border-dashed border-danger" : item.confirmed ? "border border-border" : "ai-proposal",
        selected && "outline-2 outline-offset-2 outline-ai",
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-base font-semibold">
          <span className="font-mono font-medium text-muted">{item.tier} · </span>
          {item.rule ? ruleTitle(item.rule) : "Can’t run"}
        </span>
        {!runnable ? (
          <Tag>Left out</Tag>
        ) : item.confirmed ? (
          <Tag tone="confirmed">Confirmed</Tag>
        ) : (
          <span className="font-mono text-xs text-ai-text">{pct(item.confidence)}</span>
        )}
      </div>
      {item.rule ? <span className="font-mono text-base">{describeRule(item.rule)}</span> : <span className="text-base text-danger">{item.issues.join(" ")}</span>}
      {!item.confirmed || !runnable ? <p className="ai-reasoning m-0 text-md">{item.reason}</p> : null}
      {!item.span ? <span className="text-sm text-muted">The AI’s quote for this rule wasn’t found in your text.</span> : null}

      {editing && item.rule ? (
        <RuleEditor
          rule={item.rule}
          onSave={(rule) => {
            onChange({ ...item, rule, confirmed: true });
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          {runnable && !item.confirmed ? (
            <Button variant="ink" size="sm" onClick={() => onChange({ ...item, confirmed: true })}>
              Confirm
            </Button>
          ) : null}
          {runnable ? (
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
          ) : null}
          {runnable && item.confirmed ? (
            <Button variant="ghost" size="sm" onClick={() => onChange({ ...item, confirmed: false })}>
              Undo
            </Button>
          ) : null}
          {item.span ? (
            <Button variant="ghost" size="sm" onClick={onSelect}>
              Show in source
            </Button>
          ) : null}
        </div>
      )}
    </li>
  );
}

export function ReviewStep({
  draft,
  onChange,
  selected,
  onSelect,
  library,
  libraryById,
  onBack,
  onContinue,
}: {
  draft: ProgramDraft;
  onChange: (draft: ProgramDraft) => void;
  selected: Selection;
  onSelect: (s: Selection) => void;
  library: Exercise[];
  libraryById: Map<string, Exercise>;
  onBack: () => void;
  onContinue: () => void;
}) {
  const { blocking, warnings } = draftIssues(draft);
  const updateSlot = (slot: DraftSlot) =>
    onChange({ ...draft, days: draft.days.map((d) => ({ ...d, slots: d.slots.map((s) => (s.id === slot.id ? slot : s)) })) });
  const updateRule = (rule: DraftRule) => onChange({ ...draft, rules: draft.rules.map((r) => (r.id === rule.id ? rule : r)) });
  const tiers = [...new Set(draft.rules.map((r) => r.tier))].sort();

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-label="Needs your check"
        className={cn("flex flex-col gap-3 rounded-lg px-5 py-4", blocking.length ? "ai-proposal" : "border border-border bg-surface")}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-md font-semibold">
            {blocking.length
              ? `${blocking.length} ${blocking.length === 1 ? "thing needs" : "things need"} your check before this can run`
              : "Everything is checked."}
          </span>
          <Button variant="primary" onClick={onContinue} disabled={blocking.length > 0}>
            Set starting weights
          </Button>
        </div>
        {blocking.length ? (
          <div className="flex flex-wrap gap-2">
            {blocking.map((b) => (
              <Button key={b.id} variant="secondary" size="sm" onClick={() => onSelect({ kind: b.kind, id: b.id })} className="border-dashed border-ai">
                {b.label}
              </Button>
            ))}
          </div>
        ) : null}
        <span className="text-sm text-muted">Items read with 90%+ confidence start confirmed. Rules the engine can’t run are left out, never guessed.</span>
      </section>

      {warnings.length || draft.notes.length ? (
        <Card className="flex flex-col gap-2 px-5 py-4">
          {warnings.map((w) => (
            <p key={w} className="m-0 text-base text-fg-secondary">
              {w}
            </p>
          ))}
          {draft.notes.map((n) => (
            <p key={n} className="ai-reasoning m-0 text-md">
              {n}
            </p>
          ))}
        </Card>
      ) : null}

      <div className="flex flex-wrap items-start gap-6">
        <SourcePane draft={draft} selected={selected} />

        <div className="flex min-w-0 flex-[1.4_1_520px] flex-col gap-6">
          <Card>
            <CardHeader title="Days" meta={`${draft.days.length} · rotate ${draft.days.map((d) => d.name).join(" ")}`} />
            <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2">
              {draft.days.map((day) => (
                <div key={day.id} className="flex flex-col gap-1 bg-surface px-3 py-3">
                  <Eyebrow className="px-2">Day {day.name}</Eyebrow>
                  {day.slots.map((slot) => (
                    <SlotRow
                      key={slot.id}
                      slot={slot}
                      library={library}
                      libraryById={libraryById}
                      selected={selected?.id === slot.id}
                      onSelect={() => onSelect({ kind: "slot", id: slot.id })}
                      onChange={updateSlot}
                    />
                  ))}
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Progression rules" meta="Code runs these exactly, and only once confirmed" />
            <div className="flex flex-col gap-5 p-4">
              {tiers.map((tier) => (
                <ul key={tier} className="m-0 flex list-none flex-col gap-3 p-0">
                  {draft.rules
                    .filter((r) => r.tier === tier)
                    .map((r) => (
                      <RuleCard key={r.id} item={r} selected={selected?.id === r.id} onSelect={() => onSelect({ kind: "rule", id: r.id })} onChange={updateRule} />
                    ))}
                </ul>
              ))}
            </div>
          </Card>

          <div className="flex justify-end">
            <Button variant="secondary" onClick={onBack}>
              Paste different text
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
