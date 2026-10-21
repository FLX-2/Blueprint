import { liftTrend, roundToLoadable } from "@/lib/calc/strength";
import type { Dataset } from "@/lib/dataset/dataset";
import type { Athlete, Exercise, Program, Tier } from "@/lib/domain/types";
import { currentScheme, rulesFor, slotKey, type ProgramState, type SlotKey } from "@/lib/engine/engine";

/**
 * Starting weights for a newly approved program. Code suggests them from the
 * lifter's log (best estimated 1RM in the last 12 weeks); the lifter can
 * change any of them. Nothing here is AI.
 */

export type StartInput = {
  key: SlotKey;
  /** Bodyweight lifts take added weight, so 0 is a valid start. */
  bodyweight: boolean;
  exerciseId: string;
  tier: Tier;
  scheme: string;
  /** What the number means for this slot. */
  field: "weight" | "trainingMax";
  suggestion: number | null;
  /** Why, in plain language; null when the log has no data for this lift. */
  basis: string | null;
};

const DAY_MS = 86_400_000;

export function startInputs(program: Program, data: Dataset, athlete: Athlete, exercises: Map<string, Exercise>): StartInput[] {
  const since = new Date(new Date(`${data.end}T00:00:00Z`).getTime() - 84 * DAY_MS).toISOString().slice(0, 10);
  const seen = new Set<SlotKey>();
  const inputs: StartInput[] = [];

  for (const day of program.days) {
    for (const slot of day.slots) {
      const key = slotKey(slot);
      if (seen.has(key)) continue;
      seen.add(key);

      const recent = liftTrend(data.sessions, slot.exerciseId).filter((p) => p.date >= since && p.set.weight > 0);
      const best = recent.length ? Math.max(...recent.map((p) => p.e1rm)) : null;
      const cycle = rulesFor(program, slot.tier).progression?.kind === "percentage-cycle";
      const scheme = currentScheme(program, slot, undefined);

      const bodyweight = exercises.get(slot.exerciseId)?.equipment === "bodyweight";
      let suggestion: number | null = bodyweight ? 0 : null;
      if (best !== null && !bodyweight) {
        suggestion = cycle
          ? roundToLoadable(best * 0.9, athlete.smallestPlatePair)
          : // About 90% of what the log says you could do for this many reps: a deliberately easy first week.
            roundToLoadable((best / (1 + scheme.reps / 30)) * 0.9, athlete.smallestPlatePair);
      }

      inputs.push({
        key,
        bodyweight,
        exerciseId: slot.exerciseId,
        tier: slot.tier,
        scheme: `${scheme.sets}×${scheme.reps}${scheme.amrapLast ? "+" : ""}`,
        field: cycle ? "trainingMax" : "weight",
        suggestion,
        basis: bodyweight
          ? "Bodyweight. Enter added weight if you train with a belt."
          : best === null
            ? null
            : cycle
              ? `90% of your best est. 1RM (${Math.round(best)} lb) in the last 12 weeks`
              : `90% of your est. ${scheme.reps}-rep max, from a best est. 1RM of ${Math.round(best)} lb in the last 12 weeks`,
      });
    }
  }
  return inputs;
}

/** The engine's starting state from the lifter's chosen numbers. */
export function initialState(program: Program, values: Partial<Record<SlotKey, number>>): ProgramState {
  const state: ProgramState = {};
  for (const day of program.days) {
    for (const slot of day.slots) {
      const key = slotKey(slot);
      const value = values[key];
      if (value === undefined || state[key]) continue;
      const progression = rulesFor(program, slot.tier).progression;
      state[key] =
        progression?.kind === "percentage-cycle"
          ? { weight: 0, stage: 0, cycleWeek: 0, trainingMax: value }
          : { weight: value, stage: 0, ...(progression?.kind === "double-progression" ? { reps: progression.repRange.min } : {}) };
    }
  }
  return state;
}
