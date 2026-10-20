import type { ExtractedProgram } from "./extract-schema";

/** A GZCLP write-up in a lifter's own words, with the gaps real posts have. */
export const EXAMPLE_PROGRAM_TEXT = `GZCLP, 4-day version

A1: T1 Squat, T2 Bench, T3 Lat pulldown. B1: T1 OHP, T2 Deadlift, T3 DB row. A2: T1 Bench, T2 Squat, T3 Lat pulldown. B2: T1 Deadlift, T2 OHP, T3 DB row.

T1 is 5x3+ at roughly 85% of your 5RM, last set AMRAP. Hit every rep and add 10lb for lower body, 5lb for upper. Miss reps and you drop to 6x2, then 10x1. If 10x1 fails, retest your 5RM and start again at 85%.

T2 is 3x10 around 65%. Same jumps when you complete all sets. Fail and go 3x8, then 3x6. After 3x6 stalls, reset somewhere lighter and build back up.

T3 is 3x15+, last set AMRAP. Once that last set hits 25, add weight. For the pull, lat pulldown or pull-ups, whatever your gym has.`;

const slot = (exercise: string, tier: "T1" | "T2" | "T3", sets: number, reps: number, amrap: boolean, quote: string, alternatives: string[] = []) => ({
  exercise,
  alternatives,
  tier,
  sets,
  reps,
  amrap_last: amrap,
  confidence: alternatives.length ? 0.7 : 0.95,
  source_quote: quote,
});

const T1 = (e: string, q: string) => slot(e, "T1", 5, 3, true, q);
const T2 = (e: string, q: string) => slot(e, "T2", 3, 10, false, q);
const pull = (q: string) => slot("Lat pulldown", "T3", 3, 15, true, q, ["Pull-ups"]);
const row = (q: string) => slot("DB row", "T3", 3, 15, true, q);

/**
 * A scripted reading of EXAMPLE_PROGRAM_TEXT, for when there's no API key.
 * Only the model's side is scripted; matching, quote finding, rule checks
 * and the preview run for real. The UI labels it.
 */
export const EXAMPLE_EXTRACTION: ExtractedProgram = {
  name: "GZCLP, 4-day",
  days: [
    { name: "A1", slots: [T1("Squat", "A1: T1 Squat"), T2("Bench", "T2 Bench"), pull("T3 Lat pulldown. B1")] },
    { name: "B1", slots: [T1("OHP", "B1: T1 OHP"), T2("Deadlift", "T2 Deadlift"), row("T3 DB row. A2")] },
    { name: "A2", slots: [T1("Bench", "A2: T1 Bench"), T2("Squat", "T2 Squat"), pull("T3 Lat pulldown. B2")] },
    // Real quotes overlap sometimes; the source view gives each character to the shortest quote covering it.
    { name: "B2", slots: [T1("Deadlift", "B2: T1 Deadlift"), T2("OHP", "T2 OHP"), row("T2 OHP, T3 DB row.")] },
  ],
  rules: [
    {
      tier: "T1",
      kind: "linear",
      increment_upper: 5,
      increment_lower: 10,
      rep_target: null,
      rep_min: null,
      rep_max: null,
      stages: null,
      reset: null,
      cycle_weeks: null,
      confidence: 0.96,
      reason: "“Add 10lb for lower body, 5lb for upper” after hitting every rep.",
      source_quote: "Hit every rep and add 10lb for lower body, 5lb for upper.",
    },
    {
      tier: "T1",
      kind: "stage-on-failure",
      increment_upper: null,
      increment_lower: null,
      rep_target: null,
      rep_min: null,
      rep_max: null,
      stages: [
        { sets: 5, reps: 3, amrap_last: true },
        { sets: 6, reps: 2, amrap_last: true },
        { sets: 10, reps: 1, amrap_last: true },
      ],
      reset: { sets: 5, reps: 3, amrap_last: true, percent_of: "retest-5rm", percent: 0.85 },
      cycle_weeks: null,
      confidence: 0.72,
      reason: "Read as stages in order. The text doesn’t say whether a stage repeats before moving on, so this moves on after one miss.",
      source_quote: "Miss reps and you drop to 6x2, then 10x1. If 10x1 fails, retest your 5RM and start again at 85%.",
    },
    {
      tier: "T2",
      kind: "linear",
      increment_upper: 5,
      increment_lower: 10,
      rep_target: null,
      rep_min: null,
      rep_max: null,
      stages: null,
      reset: null,
      cycle_weeks: null,
      confidence: 0.93,
      reason: "“Same jumps” refers back to T1: 10 lb lower, 5 lb upper.",
      source_quote: "Same jumps when you complete all sets.",
    },
    {
      tier: "T2",
      kind: "stage-on-failure",
      increment_upper: null,
      increment_lower: null,
      rep_target: null,
      rep_min: null,
      rep_max: null,
      stages: [
        { sets: 3, reps: 10, amrap_last: false },
        { sets: 3, reps: 8, amrap_last: false },
        { sets: 3, reps: 6, amrap_last: false },
      ],
      reset: { sets: 3, reps: 10, amrap_last: false, percent_of: "last-weight", percent: 0.85 },
      cycle_weeks: null,
      confidence: 0.48,
      reason: "“Somewhere lighter” has no number. 85% mirrors how T1 restarts; change it if your source says otherwise.",
      source_quote: "Fail and go 3x8, then 3x6. After 3x6 stalls, reset somewhere lighter and build back up.",
    },
    {
      tier: "T3",
      kind: "amrap-threshold",
      increment_upper: 5,
      increment_lower: 5,
      rep_target: 25,
      rep_min: null,
      rep_max: null,
      stages: null,
      reset: null,
      cycle_weeks: null,
      confidence: 0.91,
      reason: "Add weight once the AMRAP set reaches 25. The text gives no jump; 5 lb is the usual one.",
      source_quote: "Once that last set hits 25, add weight.",
    },
  ],
  notes: ["Starting weights are given as percentages of a 5RM (85% for T1, about 65% for T2); you’ll set them in the next step."],
};
