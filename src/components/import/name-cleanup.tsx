"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import type { Exercise } from "@/lib/domain/types";
import { groupDecisions, newTarget, targetLabel, type Decision, type Group, type Target } from "@/lib/import/decisions";

export type AiState =
  | { status: "idle" }
  | { status: "loading"; names: Set<string> }
  | { status: "done"; count: number }
  | { status: "off"; message: string };

type Props = {
  decisions: Decision[];
  onChange: (decisions: Decision[]) => void;
  ai: AiState;
  library: Exercise[];
  libraryById: Map<string, Exercise>;
  importing: boolean;
  onBack: () => void;
  onImport: () => void;
};

const percent = (n: number) => `${Math.round(n * 100)}%`;

/** How a single imported name was resolved, shown next to it. */
function MemberStatus({ d, checking }: { d: Decision; checking: boolean }) {
  if (checking) return <span className="font-mono text-xs text-ai-text">AI checking…</span>;
  const s = d.suggestion;
  if (s.method === "exact") return <span className="font-mono text-xs text-muted">Exact</span>;
  if (d.confirmed && s.method !== "ai") return <Tag tone="confirmed">Confirmed</Tag>;
  if (s.method === "ai") return <span className="font-mono text-xs text-ai-text">AI · {percent(s.confidence)} sure</span>;
  if (s.method === "similar") return <span className="font-mono text-xs text-fg-secondary">Spelling · {percent(s.confidence)}</span>;
  return <span className="font-mono text-xs text-fg-secondary">No match</span>;
}

function MemberReason({ d, checking }: { d: Decision; checking: boolean }) {
  if (checking || !d.suggestion.reason) return null;
  if (d.suggestion.method === "ai") return <p className="ai-reasoning m-0 text-md">{d.suggestion.reason}</p>;
  return <p className="m-0 text-sm text-muted">{d.suggestion.reason}</p>;
}

function GroupCard({
  group,
  props,
  update,
}: {
  group: Group;
  props: Props;
  update: (names: string[], change: (d: Decision) => Decision) => void;
}) {
  const names = group.members.map((m) => m.name);
  const pending = props.ai.status === "loading" ? props.ai.names : null;
  const checking = !!pending && names.some((n) => pending.has(n));
  const fromAi = !group.confirmed && group.members.some((m) => m.suggestion.method === "ai" && !m.confirmed);
  const label = targetLabel(group.target, props.libraryById);

  const setTarget = (value: string) => {
    const target: Target = value === "new" ? newTarget(group.members[0].name) : { kind: "library", id: value.slice(4) };
    update(names, (d) => ({ ...d, target, confirmed: true }));
  };

  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-md p-4",
        group.confirmed
          ? "border border-border bg-surface"
          : fromAi || checking
            ? "ai-proposal"
            : "border-[1.5px] border-dashed border-border-strong bg-surface",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-md font-semibold">{label}</span>
          <Tag tone={group.target.kind === "new" ? "neutral" : "confirmed"}>{group.target.kind === "new" ? "New exercise" : "Library"}</Tag>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-muted">
            <span className="sr-only sm:not-sr-only">Maps to</span>
            <select
              aria-label={`Exercise for ${names.join(", ")}`}
              value={group.target.kind === "library" ? `lib:${group.target.id}` : "new"}
              onChange={(e) => setTarget(e.target.value)}
              disabled={checking || props.importing}
              className="h-9 max-w-56 rounded-sm border border-border bg-bg px-2 text-sm text-fg"
            >
              <option value="new">{group.target.kind === "new" ? `New: ${group.target.name}` : "New exercise"}</option>
              <optgroup label="Library">
                {props.library.map((e) => (
                  <option key={e.id} value={`lib:${e.id}`}>
                    {e.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>
          {!group.confirmed && !checking ? (
            <Button variant="ink" size="sm" onClick={() => update(names, (d) => ({ ...d, confirmed: true }))} disabled={props.importing}>
              Confirm
            </Button>
          ) : null}
        </div>
      </div>

      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {group.members.map((d) => (
          <li key={d.name} className="flex flex-col gap-1 border-t border-border pt-2 first:border-t-0 first:pt-0">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span className="min-w-0 text-base">
                <span className="font-medium">“{d.name}”</span> <span className="num text-sm text-muted">· {d.sets} sets</span>
              </span>
              <span className="flex items-center gap-2">
                <MemberStatus d={d} checking={checking} />
                {group.members.length > 1 ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    disabled={checking || props.importing}
                    onClick={() => update([d.name], (x) => ({ ...x, target: newTarget(x.name), confirmed: true }))}
                  >
                    Split
                  </Button>
                ) : null}
              </span>
            </div>
            <MemberReason d={d} checking={checking} />
          </li>
        ))}
      </ul>
    </li>
  );
}

export function NameCleanup(props: Props) {
  const { decisions, onChange, ai, libraryById, importing } = props;
  const groups = groupDecisions(decisions, libraryById);
  const toCheck = groups.filter((g) => !g.confirmed);
  const exact = groups.filter((g) => g.confirmed && g.target.kind === "library" && g.members.every((m) => m.suggestion.method === "exact"));
  const settled = groups.filter((g) => g.confirmed && !exact.includes(g));
  const remaining = decisions.filter((d) => !d.confirmed).length;
  const waiting = ai.status === "loading";

  const update = (names: string[], change: (d: Decision) => Decision) => {
    const set = new Set(names);
    onChange(decisions.map((d) => (set.has(d.name) ? change(d) : d)));
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="m-0 text-md text-fg-secondary">
          <span className="num text-fg">{decisions.length}</span> names → <span className="num text-fg">{groups.length}</span> exercises.{" "}
          {remaining ? (
            <>
              <span className="num text-fg">{remaining}</span> need a look.
            </>
          ) : (
            "Everything is confirmed."
          )}
        </p>
        {ai.status === "loading" ? (
          <span className="font-mono text-sm text-ai-text">Checking {ai.names.size} names with AI…</span>
        ) : ai.status === "done" ? (
          <span className="font-mono text-sm text-muted">AI checked {ai.count} names</span>
        ) : null}
      </div>

      {ai.status === "off" ? (
        <p className="m-0 rounded-md border border-border bg-surface px-4 py-3 text-base text-fg-secondary">
          {ai.message} Showing spelling matches only, so you may need to pick a few exercises yourself.
        </p>
      ) : null}

      {toCheck.length ? (
        <section aria-label="Needs a look" className="flex flex-col gap-3">
          <h2 className="m-0 text-md font-semibold">Needs a look</h2>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {toCheck.map((g) => (
              <GroupCard key={g.key} group={g} props={props} update={update} />
            ))}
          </ul>
        </section>
      ) : null}

      {settled.length ? (
        <section aria-label="Confirmed" className="flex flex-col gap-3">
          <h2 className="m-0 text-md font-semibold">Confirmed</h2>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {settled.map((g) => (
              <GroupCard key={g.key} group={g} props={props} update={update} />
            ))}
          </ul>
        </section>
      ) : null}

      {exact.length ? (
        <Card>
          <details>
            <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-5 text-md font-semibold">
              <span>Matched the library exactly</span>
              <span className="font-mono text-xs font-normal text-muted">
                {exact.reduce((n, g) => n + g.members.length, 0)} names · {exact.length} exercises
              </span>
            </summary>
            <ul className="m-0 flex list-none flex-col gap-3 border-t border-border p-4">
              {exact.map((g) => (
                <GroupCard key={g.key} group={g} props={props} update={update} />
              ))}
            </ul>
          </details>
        </Card>
      ) : null}

      <div className="sticky bottom-20 z-10 flex items-center justify-between gap-3 rounded-lg border border-border bg-surface py-3 pr-3 pl-4 md:bottom-4 md:pl-5">
        <span className="min-w-0 text-sm text-fg-secondary md:text-base">
          {waiting ? "Waiting for AI…" : remaining ? `${remaining} to confirm` : "Ready to import"}
        </span>
        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" onClick={props.onBack} disabled={importing}>
            Back
          </Button>
          <Button variant="primary" onClick={props.onImport} disabled={remaining > 0 || waiting || importing}>
            {importing ? "Importing…" : "Import history"}
          </Button>
        </div>
      </div>
    </div>
  );
}
