import { athlete, exerciseById, program, sessions } from "@/data/seed";
import { nextDay } from "@/lib/domain/describe";
import { prescribe, slotKey, stateFromHistory } from "./engine";
import { platesFor } from "./plates";

/**
 * The sample athlete's next session, as the rule engine prescribes it.
 * (Imported histories have no program attached yet, so Train stays on the
 * sample program until F1 lets a lifter import their own.)
 */
export function todaysSession() {
  const day = nextDay(program, sessions);
  const { state, lastEvents } = stateFromHistory({ program, sessions, exercises: exerciseById, athlete });
  const items = prescribe(program, day, state, athlete).map((p) => {
    const exercise = exerciseById.get(p.slot.exerciseId)!;
    const top = p.sets?.at(-1)?.weight ?? null;
    return {
      ...p,
      exercise,
      weight: top,
      plates: top !== null && exercise.equipment === "barbell" ? platesFor(top, athlete.barWeight) : null,
      because: lastEvents[slotKey(p.slot)],
    };
  });
  return { day, items };
}
