import * as z from "zod/v4";

/**
 * What the model returns when it reads a pasted program (POST /api/extract-program).
 * It's deliberately flat: every rule kind's parameters are nullable fields,
 * and code (convert.ts) checks that the ones a kind needs are present.
 * Source quotes are copied text; code finds where they are.
 */

const Tier = z.enum(["T1", "T2", "T3"]);
const Scheme = z.object({ sets: z.int(), reps: z.int(), amrap_last: z.boolean() });

export const RULE_KINDS = ["linear", "stage-on-failure", "amrap-threshold", "double-progression", "percentage-cycle", "unsupported"] as const;

export const ExtractedProgram = z.object({
  name: z.string().describe("The program's name, e.g. 'GZCLP, 4-day'."),
  days: z.array(
    z.object({
      name: z.string().describe("Day label as written, e.g. 'A1' or 'Monday'."),
      slots: z.array(
        z.object({
          exercise: z.string().describe("The exercise as written, e.g. 'Lat pulldown'."),
          alternatives: z.array(z.string()).describe("Other exercises the text allows in this slot ('or pull-ups'). Empty if none."),
          tier: Tier.describe("Group slots that share progression rules. Use T1 for everything if the program has one scheme."),
          sets: z.int(),
          reps: z.int(),
          amrap_last: z.boolean().describe("True when the last set is as many reps as possible ('3+', 'AMRAP')."),
          confidence: z.number().describe("0 to 1."),
          source_quote: z.string().describe("A short exact quote from the text that this slot comes from."),
        }),
      ),
    }),
  ),
  rules: z.array(
    z.object({
      tier: Tier,
      kind: z.enum(RULE_KINDS),
      increment_upper: z.number().nullable().describe("lb added for upper-body lifts (linear, amrap-threshold, double-progression, percentage-cycle)."),
      increment_lower: z.number().nullable().describe("lb added for lower-body lifts."),
      rep_target: z.int().nullable().describe("amrap-threshold: reps on the last set that earn more weight."),
      rep_min: z.int().nullable().describe("double-progression: bottom of the rep range."),
      rep_max: z.int().nullable().describe("double-progression: top of the rep range."),
      stages: z.array(Scheme).nullable().describe("stage-on-failure: schemes in order, starting with the normal one."),
      reset: z
        .object({
          sets: z.int(),
          reps: z.int(),
          amrap_last: z.boolean(),
          percent_of: z.enum(["last-weight", "retest-5rm"]),
          percent: z.number().describe("Fraction, e.g. 0.85."),
        })
        .nullable()
        .describe("stage-on-failure: what to do after the last stage fails."),
      cycle_weeks: z
        .array(z.object({ sets: z.array(z.object({ percent: z.number(), reps: z.int(), amrap: z.boolean() })) }))
        .nullable()
        .describe("percentage-cycle: each week's sets as fractions of the training max."),
      confidence: z.number().describe("0 to 1. Below 0.9 when you had to assume something the text doesn't say."),
      reason: z.string().describe("One sentence: how you read it, and what you assumed if anything."),
      source_quote: z.string().describe("A short exact quote from the text this rule comes from."),
    }),
  ),
  notes: z.array(z.string()).describe("Anything in the text you couldn't represent (deloads, warm-ups, conditioning). Empty if none."),
});

export type ExtractedProgram = z.infer<typeof ExtractedProgram>;
export type ExtractedRule = ExtractedProgram["rules"][number];
export type ExtractedSlot = ExtractedProgram["days"][number]["slots"][number];
