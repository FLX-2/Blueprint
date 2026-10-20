import type { Equipment, Exercise, MovementPattern, MuscleGroup } from "@/lib/domain/types";
import { AUTO_CONFIRM, nameKey, type Suggestion } from "./match";

/**
 * The user's decision for each imported name: which exercise it becomes,
 * and whether they've confirmed it. Nothing is imported until every name
 * is confirmed (exact matches and 90%+ suggestions start confirmed).
 */

export type Target =
  | { kind: "library"; id: string }
  | { kind: "new"; key: string; name: string; pattern: MovementPattern; muscles: MuscleGroup[] };

export type Decision = {
  name: string;
  sets: number;
  target: Target;
  confirmed: boolean;
  suggestion: Suggestion;
};

export type Group = {
  key: string;
  target: Target;
  members: Decision[];
  confirmed: boolean;
};

export function groupKey(target: Target) {
  return target.kind === "library" ? `lib:${target.id}` : `new:${target.key}`;
}

/** "flat bench (bb)" → "Flat Bench (Bb)": tidy, without guessing too much. */
function titleCase(name: string) {
  return name.trim().replace(/\s+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function newTarget(name: string, draft?: Suggestion["newExercise"]): Target {
  const display = draft?.name ?? titleCase(name);
  return {
    kind: "new",
    key: nameKey(display) || display.toLowerCase(),
    name: display,
    pattern: draft?.pattern ?? "accessory",
    muscles: draft?.muscles ?? [],
  };
}

export function decisionFrom(suggestion: Suggestion, sets: number): Decision {
  const target: Target = suggestion.exerciseId
    ? { kind: "library", id: suggestion.exerciseId }
    : newTarget(suggestion.name, suggestion.newExercise);
  return {
    name: suggestion.name,
    sets,
    target,
    // Exact matches and confident AI answers start confirmed; unmatched names
    // ("method: none") need a look even though nothing was proposed.
    confirmed: suggestion.method === "exact" || (suggestion.method !== "none" && suggestion.confidence >= AUTO_CONFIRM),
    suggestion,
  };
}

/** Groups decisions by target. Needs-a-look groups first, then new exercises, then the rest. */
export function groupDecisions(decisions: Decision[], library: Map<string, Exercise>): Group[] {
  const groups = new Map<string, Group>();
  for (const d of decisions) {
    const key = groupKey(d.target);
    const group = groups.get(key) ?? { key, target: d.target, members: [], confirmed: true };
    group.members.push(d);
    group.confirmed &&= d.confirmed;
    groups.set(key, group);
  }
  const label = (g: Group) => (g.target.kind === "library" ? (library.get(g.target.id)?.name ?? g.target.id) : g.target.name);
  const rank = (g: Group) => (!g.confirmed ? 0 : g.target.kind === "new" ? 1 : 2);
  return [...groups.values()].sort((a, b) => rank(a) - rank(b) || label(a).localeCompare(label(b)));
}

export function targetLabel(target: Target, library: Map<string, Exercise>) {
  return target.kind === "library" ? (library.get(target.id)?.name ?? target.id) : target.name;
}

export function guessEquipment(name: string): Equipment {
  const n = name.toLowerCase();
  if (/barbell|\bbb\b|ez/.test(n)) return "barbell";
  if (/dumbbell|\bdbs?\b|kettlebell|\bkb\b/.test(n)) return "dumbbell";
  if (/cable|rope|pulley/.test(n)) return "cable";
  if (/machine|smith|sled|press machine/.test(n)) return "machine";
  if (/push.?up|pull.?up|chin.?up|dip|plank|bodyweight/.test(n)) return "bodyweight";
  return "machine";
}

/**
 * Turns confirmed decisions into: a name → exercise id resolver, and the
 * custom exercises to create (one per "new" target, with every imported
 * spelling kept as an alias).
 */
export function resolveDecisions(decisions: Decision[]) {
  const custom = new Map<string, Exercise>();
  const idFor = new Map<string, string>();
  for (const d of decisions) {
    if (d.target.kind === "library") {
      idFor.set(d.name, d.target.id);
      continue;
    }
    const id = `custom-${d.target.key.replace(/\s+/g, "-") || "exercise"}`;
    const existing = custom.get(id);
    if (existing) {
      if (!existing.aliases.includes(d.name)) existing.aliases.push(d.name);
    } else {
      custom.set(id, {
        id,
        name: d.target.name,
        aliases: d.name === d.target.name ? [] : [d.name],
        pattern: d.target.pattern,
        muscles: d.target.muscles,
        equipment: guessEquipment(`${d.target.name} ${d.name}`),
        body: d.target.muscles.includes("legs") ? "lower" : "upper",
      });
    }
    idFor.set(d.name, id);
  }
  return {
    exerciseIdFor: (name: string) => idFor.get(name) ?? "custom-unknown",
    customExercises: [...custom.values()],
  };
}
