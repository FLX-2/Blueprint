"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Tag } from "@/components/ui/text";
import { CheckIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { describeRule, formatScheme, ruleTitle } from "@/lib/domain/describe";
import type { Exercise } from "@/lib/domain/types";
import { matchName } from "@/lib/import/match";
import { draftIssues, type DraftRule, type DraftSlot, type ProgramDraft } from "@/lib/program/convert";
import { segmentSource, type Mark } from "@/lib/program/source-segments";
import { RuleEditor } from "./rule-editor";
import { DayTitle, TierLabel } from "@/components/ui/terms";

export type Selection = { kind: "slot" | "rule"; id: string } | null;
/** What needed a check when the AI's reading came back, numbered in that order. Numbers stay put as items are resolved. */
export type CheckItem = { kind: "slot" | "rule"; id: string; label: string };

function CheckNumber({ n, done }: { n: number; done?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-semibold",
        done ? "bg-accent text-accent-fg" : "bg-ai text-inverse",
      )}
      aria-hidden="true"
    >
      {done ? <CheckIcon width={12} height={12} strokeWidth={3} /> : n}
    </span>
  );
}

function ReadClearly({ checked }: { checked: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted">
      <CheckIcon width={13} height={13} />
      {checked ? "Checked by you" : "Read clearly"}
    </span>
  );
}

const pct = (n: number) => `${Math.round(n * 100)}% sure`;
const customId = (name: string) => `custom-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

function SourcePane({ draft, selected, numberOf }: { draft: ProgramDraft; selected: Selection; numberOf: Map<string, number> }) {
  const marks: Mark[] = [
    ...draft.rules.flatMap((r) => (r.span ? [{ id: r.id, span: r.span, flagged: !r.confirmed }] : [])),
    ...draft.days.flatMap((d) => d.slots.flatMap((s) => (s.span ? [{ id: s.id, span: s.span, flagged: !s.confirmed }] : []))),
  ];
  const segments = segmentSource(draft.sourceText, marks, selected?.id ?? null);
  const numbered = new Set<string>();

  return (
    <Card className="min-w-0 flex-[1_1_380px] lg:sticky lg:top-24">
      <CardHeader title="Source" meta={`pasted text · ${draft.sourceText.length.toLocaleString("en-US")} chars`} />
      {/* Scrolls on its own, so it takes keyboard focus to scroll with the arrow keys. */}
      <div
        tabIndex={0}
        role="region"
        aria-label="Your pasted text"
        className="max-h-[70vh] overflow-auto rounded-b-lg p-6 font-display text-lg leading-[1.7] whitespace-pre-wrap text-fg-secondary focus-visible:outline-offset-[-2px]"
      >
        {segments.map((seg, i) => {
          if (!seg.mark) return <span key={i}>{seg.text}</span>;
          const n = seg.mark.flagged && !numbered.has(seg.mark.id) ? numberOf.get(seg.mark.id) : undefined;
          if (n) numbered.add(seg.mark.id);
          return (
            <span
              key={i}
              className={cn(
                "text-fg transition-colors duration-200",
                seg.mark.flagged
                  ? "rounded-xs border-b-[1.5px] border-dashed border-ai bg-ai-mark"
                  : "underline decoration-border-input decoration-dotted decoration-1 underline-offset-[5px]",
                seg.selected && "rounded-xs outline-2 outline-offset-2 outline-focus",
              )}
            >
              {seg.text}
              {n ? (
                <sup className="ml-0.5 align-super font-mono text-[11px] font-semibold text-ai-text not-italic" aria-label={`check ${n}`}>
                  {n}
                </sup>
              ) : null}
            </span>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-5 border-t border-dashed border-border px-5 py-3.5 text-xs text-muted">
        <span className="flex items-center gap-2">
          <span className="h-3 w-7 rounded-xs border-b-[1.5px] border-dashed border-ai bg-ai-mark" aria-hidden="true" />
          Needs your check
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-7 border-b border-dotted border-border-input" aria-hidden="true" />
          Read clearly, or checked
        </span>
      </div>
    </Card>
  );
}

function SlotRow({
  number,
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
  /** Its number in the check list, if it needed a check. */
  number?: number;
}) {
  const options = [slot.name, ...slot.alternatives].map((name) => ({ name, match: matchName(name, library) }));
  const resolvedName = slot.exerciseId ? (libraryById.get(slot.exerciseId)?.name ?? slot.name) : null;

  return (
    <div
      id={`item-${slot.id}`}
      className={cn(
        "flex scroll-mt-40 flex-col gap-1.5 rounded-md px-3 py-2 transition-colors duration-200",
        !slot.confirmed ? "ai-proposal my-1 py-3" : selected && "bg-surface-raised",
        selected && !slot.confirmed && "outline-2 outline-offset-2 outline-focus",
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <TierLabel tier={slot.tier} />
        {slot.confirmed ? <ReadClearly checked={number !== undefined} /> : null}
      </span>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2">
        <button type="button" onClick={onSelect} className="flex min-w-0 items-center gap-2 truncate text-left text-base font-medium text-fg hover:underline">
          {!slot.confirmed && number ? <CheckNumber n={number} /> : null}
          {resolvedName ?? <span>{[slot.name, ...slot.alternatives].join(" or ")}?</span>}
        </button>
        <span className="font-mono text-sm text-fg-secondary">{formatScheme(slot.scheme)}</span>
      </div>
      {!slot.confirmed ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm text-fg-secondary">
            {slot.alternatives.length ? "The program lists more than one exercise here. Which will you do?" : `Which exercise did the program mean? (${pct(slot.confidence)})`}
          </span>
          <div className="flex flex-wrap items-center gap-2">
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
          </div>
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
  number,
}: {
  item: DraftRule;
  selected: boolean;
  onSelect: () => void;
  onChange: (item: DraftRule) => void;
  number?: number;
}) {
  const [editing, setEditing] = useState(false);
  const runnable = !!item.rule;

  return (
    <li
      id={`item-${item.id}`}
      className={cn(
        "flex scroll-mt-40 flex-col gap-2.5 rounded-md p-4 transition-colors duration-200",
        !runnable ? "border border-dashed border-danger" : item.confirmed ? "border border-border" : "ai-proposal",
        selected && "outline-2 outline-offset-2 outline-focus",
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="flex items-center gap-2 text-base font-semibold">
          {runnable && !item.confirmed && number ? <CheckNumber n={number} /> : null}
          <TierLabel tier={item.tier} plural />
          {item.rule ? ruleTitle(item.rule) : "Can’t run"}
        </span>
        {!runnable ? (
          <Tag>Left out</Tag>
        ) : item.confirmed ? (
          <ReadClearly checked={number !== undefined} />
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
          {runnable && item.confirmed && number !== undefined ? (
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

/** The numbered list of what needs a check, with progress. Click an item to jump to it. */
function CheckSummary({ items, open, onSelect, clearCount }: { items: CheckItem[]; open: Set<string>; onSelect: (s: Selection) => void; clearCount: number }) {
  const done = items.filter((i) => !open.has(i.id)).length;
  const left = items.length - done;
  return (
    <section
      aria-labelledby="check-summary"
      className={cn("flex flex-col gap-4 rounded-lg px-5 py-4 transition-colors duration-300", left ? "ai-proposal" : "border border-border bg-surface")}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 id="check-summary" className="m-0 text-md font-semibold">
          {items.length === 0
            ? "Everything was read clearly."
            : left
              ? `${left} of ${items.length} ${items.length === 1 ? "item needs" : "items need"} your check`
              : "All checked. Nice."}
        </h3>
        <span className="text-sm text-fg-secondary">
          {clearCount} other {clearCount === 1 ? "item was" : "items were"} read clearly and need nothing from you.
        </span>
      </div>
      {items.length ? (
        <>
          <div className="h-1 overflow-hidden rounded-full bg-surface-raised" aria-hidden="true">
            <div className="h-full rounded-full bg-accent transition-[width] duration-500 ease-standard" style={{ width: `${(done / items.length) * 100}%` }} />
          </div>
          <ol className="m-0 flex list-none flex-wrap gap-2 p-0">
            {items.map((item, i) => {
              const isOpen = open.has(item.id);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onSelect({ kind: item.kind, id: item.id })}
                    className={cn(
                      "flex h-9 items-center gap-2 rounded-full border pr-3.5 pl-2 text-sm transition-colors duration-150",
                      isOpen ? "border-ai bg-surface text-fg hover:bg-surface-raised" : "border-border text-muted line-through decoration-1 hover:text-fg",
                    )}
                  >
                    <CheckNumber n={i + 1} done={!isOpen} />
                    {item.label}
                    <span className="sr-only">{isOpen ? " (needs your check)" : " (checked)"}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </>
      ) : null}
    </section>
  );
}

export function ReviewStep({
  draft,
  onChange,
  selected,
  onSelect,
  library,
  libraryById,
  toCheck,
}: {
  draft: ProgramDraft;
  onChange: (draft: ProgramDraft) => void;
  selected: Selection;
  onSelect: (s: Selection) => void;
  library: Exercise[];
  libraryById: Map<string, Exercise>;
  toCheck: CheckItem[];
}) {
  const { blocking, warnings } = draftIssues(draft);
  const open = new Set(blocking.map((b) => b.id));
  const numberOf = new Map(toCheck.map((c, i) => [c.id, i + 1]));
  const updateSlot = (slot: DraftSlot) =>
    onChange({ ...draft, days: draft.days.map((d) => ({ ...d, slots: d.slots.map((s) => (s.id === slot.id ? slot : s)) })) });
  const updateRule = (rule: DraftRule) => onChange({ ...draft, rules: draft.rules.map((r) => (r.id === rule.id ? rule : r)) });
  const tiers = [...new Set(draft.rules.map((r) => r.tier))].sort();
  const total = draft.days.reduce((n, d) => n + d.slots.length, 0) + draft.rules.filter((r) => r.rule).length;

  return (
    <>
      <CheckSummary items={toCheck} open={open} onSelect={onSelect} clearCount={total - toCheck.length} />

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
        <SourcePane draft={draft} selected={selected} numberOf={numberOf} />

        <div className="flex min-w-0 flex-[1.4_1_520px] flex-col gap-6">
          <Card>
            <CardHeader title="Workouts" meta={`${draft.days.length} · done in order`} />
            <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2">
              {draft.days.map((day) => (
                <div key={day.id} className="flex flex-col gap-1 bg-surface px-2 py-3">
                  <h3 className="m-0 px-3 pb-1 text-base font-semibold">
                    <DayTitle program={draft} day={day} />
                  </h3>
                  {day.slots.map((slot) => (
                    <SlotRow
                      key={slot.id}
                      slot={slot}
                      number={numberOf.get(slot.id)}
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
            <CardHeader title="Progression rules" meta="Code runs these exactly, once confirmed" />
            <div className="flex flex-col gap-5 p-4">
              {tiers.map((tier) => (
                <ul key={tier} className="m-0 flex list-none flex-col gap-3 p-0">
                  {draft.rules
                    .filter((r) => r.tier === tier)
                    .map((r) => (
                      <RuleCard
                        key={r.id}
                        item={r}
                        number={numberOf.get(r.id)}
                        selected={selected?.id === r.id}
                        onSelect={() => onSelect({ kind: "rule", id: r.id })}
                        onChange={updateRule}
                      />
                    ))}
                </ul>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
