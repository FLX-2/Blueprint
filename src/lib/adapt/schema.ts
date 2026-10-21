import * as z from "zod/v4";

/** Shared contract for POST /api/adapt-week. */

export const AdaptRequest = z.object({
  constraint: z.string().trim().min(3).max(1000),
  gym: z
    .object({ name: z.string(), equipment: z.array(z.string()), maxDumbbell: z.number().nullable() })
    .nullable(),
  /** The coming sessions, as the engine prescribes them (built in the browser). */
  sessions: z
    .array(
      z.object({
        position: z.int(),
        day: z.string(),
        slots: z.array(z.object({ slot_key: z.string(), exercise: z.string(), equipment: z.string(), pattern: z.string(), scheme: z.string(), weight: z.number().nullable() })),
      }),
    )
    .min(1)
    .max(8),
  library: z.array(z.object({ id: z.string(), name: z.string(), equipment: z.string(), pattern: z.string(), muscles: z.array(z.string()) })).max(200),
});
export type AdaptRequest = z.infer<typeof AdaptRequest>;

/** What the model returns. Code checks every change before the lifter sees it (src/lib/adapt/changes.ts). */
export const AdaptProposal = z.object({
  summary: z.string().describe("Two sentences at most: what you changed and what the week loses, if anything."),
  safety_note: z.string().nullable().describe("Only when pain or injury is mentioned: suggest a professional. Otherwise null."),
  changes: z.array(
    z.object({
      position: z.int().describe("Which coming session, from the list."),
      slot_key: z.string().describe("The slot to change, copied from the list."),
      kind: z.enum(["swap", "reduce", "skip"]),
      exercise_id: z.string().nullable().describe("swap only: a library id."),
      sets: z.int().nullable().describe("swap: sets for the replacement. reduce: the new, smaller number of sets."),
      reps: z.int().nullable().describe("swap only."),
      amrap_last: z.boolean().nullable().describe("swap only."),
      reason: z.string().describe("One short sentence a lifter would understand."),
    }),
  ),
});
export type AdaptProposal = z.infer<typeof AdaptProposal>;

export type AdaptReply = { status: "ok"; proposal: AdaptProposal } | { status: "unavailable"; message: string };
