import * as z from "zod/v4";

/**
 * Tool contracts for Ask (F4), shared by the server (sends them to Claude)
 * and the browser (validates inputs and runs them on local data).
 *
 * Every field is required; optional ones are nullable. That shape is what
 * strict tool use expects, and it keeps the model explicit about defaults.
 * Strict schemas allow at most 16 nullable (union-typed) fields across all
 * tools, so keep new optional fields to a minimum (15 today).
 */

const Date_ = z.string().describe("Calendar date, YYYY-MM-DD.");
const OptionalDate = z.string().nullable().describe("Calendar date, YYYY-MM-DD, or null for the start/end of the data.");
const Muscle = z.enum(["chest", "back", "legs", "shoulders", "arms"]);
const Period = z.strictObject({ from: Date_, to: Date_ });

export const ToolInputs = {
  list_exercises: z.strictObject({}),
  lift_trend: z.strictObject({
    exercise_id: z.string().describe("Exercise id from list_exercises."),
    from: OptionalDate,
    to: OptionalDate,
  }),
  weekly_sets: z.strictObject({
    muscle: Muscle.nullable().describe("Count working sets for every exercise that trains this muscle group."),
    exercise_id: z.string().nullable().describe("Or count sets of one exercise. Give muscle or exercise_id, not both."),
    from: OptionalDate,
    to: OptionalDate,
  }),
  training_frequency: z.strictObject({ from: OptionalDate, to: OptionalDate }),
  compare_periods: z.strictObject({
    metric: z.enum(["best_e1rm", "weekly_sets", "sessions_per_week"]),
    exercise_id: z.string().nullable().describe("Required for best_e1rm; optional for weekly_sets."),
    muscle: Muscle.nullable().describe("For weekly_sets across a muscle group."),
    period_a: Period,
    period_b: Period,
  }),
  find_plateaus: z.strictObject({
    min_weeks: z.number().describe("Weeks without a new best to count as a plateau. Use 6 unless the lifter asks otherwise."),
  }),
  show_answer: z.strictObject({
    charts: z
      .array(
        z.strictObject({
          result_id: z.string().describe("A result_id from lift_trend, weekly_sets or training_frequency."),
          title: z.string(),
          highlight: z.strictObject({ from: Date_, to: Date_, label: z.string() }).nullable(),
        }),
      )
      .describe("0 to 2 charts, most important first."),
    answer: z
      .array(
        z.strictObject({
          text: z.string().describe("One sentence or clause. Segments are joined with spaces."),
          evidence: z
            .strictObject({ result_id: z.string(), from: OptionalDate, to: OptionalDate })
            .nullable()
            .describe("The result (and date range) that supports this segment. Required when it states a fact from the data."),
        }),
      )
      .describe("The answer, 2 to 5 short segments."),
    caveat: z.string().describe("One sentence on what the data can't show, e.g. correlation vs cause."),
    suggestion: z.string().nullable().describe("At most one concrete, low-risk training change, or null."),
    follow_ups: z.array(z.string()).describe("Up to 3 short follow-up questions the lifter might ask next."),
  }),
} as const;

export type ToolName = keyof typeof ToolInputs;
export type ToolInput<N extends ToolName> = z.infer<(typeof ToolInputs)[N]>;
export type ShowAnswerInput = ToolInput<"show_answer">;

export const TOOL_DESCRIPTIONS: Record<ToolName, string> = {
  list_exercises:
    "Lists every exercise in the lifter's log with its id, name, number of sessions, and first and last date. Call it first when you're not sure of an exercise id.",
  lift_trend:
    "Best estimated 1RM (Epley) per week for one exercise, with each week's top set, plus a summary: first and last week, best week, change, and weeks since the last new best. Weights are in lb.",
  weekly_sets:
    "Working sets per week, for a muscle group or one exercise, with training days per week and the average.",
  training_frequency: "Training sessions per week and the average.",
  compare_periods:
    "Compares two date ranges on one metric and returns both values, the difference and the percent change. Use this instead of doing arithmetic yourself.",
  find_plateaus:
    "Finds lifts that haven't set a new best estimated 1RM (more than 1% above the previous best) in at least min_weeks weeks, as of the last logged session.",
  show_answer:
    "Shows your final answer to the lifter, with charts built from earlier results. Call it exactly once, after the analysis tools, as the last thing you do.",
};
