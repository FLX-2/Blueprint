import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { exercises } from "@/data/seed/exercises";
import { MatchRequest, ModelMatches, type MatchResponse } from "@/lib/import/ai-match-schema";

/**
 * Matches exercise names that code couldn't resolve with certainty.
 * Only names are sent to the model: never weights, reps or dates.
 */

const LIBRARY = exercises.map((e) => `${e.id}: ${e.name} (also: ${e.aliases.join(", ")})`).join("\n");

// Stable across requests so the prompt prefix caches.
const SYSTEM = `You match exercise names from a lifter's workout-log export to an exercise library.

For each imported name:
- If it is the same movement as a library exercise (same implement and pattern; naming, abbreviation, and order don't matter), return that library id.
- Variations that change the movement are different exercises: incline vs flat, dumbbell vs barbell, front vs back squat, Romanian vs conventional deadlift.
- If nothing in the library is the same movement, return exerciseId null and describe a new exercise: a clean name, its movement pattern, and the muscle groups it mainly trains.
- Confidence is how sure you are. Use 0.9 or above only when a coach would agree without hesitation. Be lower for ambiguous names ("Press", "Rows") and say what's ambiguous in the reason.
- Return exactly one entry per imported name, with the name copied exactly.

Library (id: name (also: aliases)):
${LIBRARY}`;

function unavailable(message: string, status = 503) {
  return Response.json({ status: "unavailable", message } satisfies MatchResponse, { status });
}

export async function POST(request: Request) {
  const body = MatchRequest.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Expected { names: string[] } (1–100 names)." }, { status: 400 });

  try {
    const client = new Anthropic();
    const response = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      // Policy declines (rare for exercise names) retry on Anthropic's recommended model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(ModelMatches) },
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: `Imported names:\n${body.data.names.map((n) => `- ${n}`).join("\n")}` }],
    });

    if (response.stop_reason === "refusal") return unavailable("The AI declined to match these names.", 502);
    if (!response.parsed_output) return unavailable("The AI returned an unreadable answer.", 502);

    const wanted = new Set(body.data.names);
    const matches = response.parsed_output.matches
      .filter((m) => wanted.has(m.name))
      .map((m) => ({ ...m, confidence: Math.max(0, Math.min(1, m.confidence)) }));
    return Response.json({ status: "ok", matches } satisfies MatchResponse);
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      return unavailable("AI matching is off: the Anthropic credentials were rejected.");
    }
    if (error instanceof Anthropic.RateLimitError) return unavailable("AI matching is busy. Try again in a minute.", 429);
    if (error instanceof Anthropic.APIError) return unavailable(`AI matching failed (${error.status ?? "network"}).`, 502);
    // Anything else (most often: no API key, token or profile, which the SDK
    // reports as a plain Error before sending) degrades to spelling matches.
    console.error("[match-exercises]", error);
    return unavailable("AI matching isn’t set up here (no Anthropic API key), or it couldn’t run.");
  }
}
