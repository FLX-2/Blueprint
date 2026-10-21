import type { ProposedChange } from "./changes";

/**
 * A scripted proposal for the sample athlete, for when there's no API key.
 * Positions assume the sample program's next session is Day B2 (B2, A1, B1,
 * A2). Only the model's side is scripted: every change still goes through
 * the same checks, weights and effects as a live one, and the UI labels it.
 */

export const EXAMPLE_CONSTRAINT =
  "Traveling for my next three sessions. The hotel gym has dumbbells up to 50 lb and a few machines, no barbells.";
export const EXAMPLE_GYM_ID = "hotel";

export const EXAMPLE_SUMMARY =
  "Swapped every barbell and cable lift in the next three sessions for the closest dumbbell, machine or bodyweight movement, keeping each session's main pattern. Day A2 is after you’re back, so it’s unchanged.";

const swap = (position: number, slot_key: string, exercise_id: string, sets: number, reps: number, reason: string, amrap_last = false): ProposedChange => ({
  position,
  slot_key,
  kind: "swap",
  exercise_id,
  sets,
  reps,
  amrap_last,
  reason,
});

export const EXAMPLE_PROPOSALS: ProposedChange[] = [
  swap(0, "T1:deadlift", "bulgarian-split-squat", 4, 8, "No barbell. Split squats keep heavy lower-body work with 50 lb dumbbells."),
  swap(0, "T2:overhead-press", "dumbbell-shoulder-press", 3, 10, "Same pressing pattern with dumbbells."),
  swap(1, "T1:back-squat", "goblet-squat", 4, 10, "Goblet squats are the closest squat with one 50 lb dumbbell; more reps make up for the lighter load."),
  swap(1, "T2:bench-press", "dumbbell-bench-press", 3, 10, "Same press, dumbbells instead of a bar."),
  swap(1, "T3:lat-pulldown", "pull-up", 3, 8, "No cable stack. Pull-ups train the same vertical pull.", true),
  swap(2, "T1:overhead-press", "dumbbell-shoulder-press", 4, 8, "Heavier dumbbell pressing in place of the barbell."),
  swap(2, "T2:deadlift", "lunge", 3, 12, "Walking lunges keep the hip and leg work without a barbell."),
  // A proposal the checks turn down: the row already has 3 sets.
  { position: 2, slot_key: "T3:dumbbell-row", kind: "reduce", exercise_id: null, sets: 3, reps: null, amrap_last: null, reason: "Keep the session short." },
];
