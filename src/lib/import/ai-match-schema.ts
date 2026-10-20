import * as z from "zod/v4";

/** Shared contract for POST /api/match-exercises (used by the route and the client). */

export const MUSCLES = ["chest", "back", "legs", "shoulders", "arms"] as const;
export const PATTERNS = [
  "squat",
  "hinge",
  "horizontal-push",
  "vertical-push",
  "horizontal-pull",
  "vertical-pull",
  "accessory",
] as const;

export const MatchRequest = z.object({
  names: z.array(z.string().trim().min(1).max(80)).min(1).max(100),
});

/** What the model must return. Every number shown later comes from code, not from this. */
export const ModelMatches = z.object({
  matches: z.array(
    z.object({
      name: z.string().describe("The imported name, copied exactly."),
      exerciseId: z
        .string()
        .nullable()
        .describe("Library id this name refers to, or null if no library exercise is the same movement."),
      confidence: z.number().describe("0 to 1: how sure you are about exerciseId (or that it's a new exercise)."),
      reason: z.string().describe("One short sentence a lifter would understand."),
      newExercise: z
        .object({
          name: z.string().describe("A clean canonical name, e.g. 'Cable Lateral Raise'."),
          pattern: z.enum(PATTERNS),
          muscles: z.array(z.enum(MUSCLES)),
        })
        .nullable()
        .describe("Only when exerciseId is null."),
    }),
  ),
});
export type ModelMatches = z.infer<typeof ModelMatches>;

export type MatchResponse =
  | { status: "ok"; matches: ModelMatches["matches"] }
  | { status: "unavailable"; message: string };
