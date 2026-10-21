import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { AdaptProposal, AdaptRequest, type AdaptReply } from "@/lib/adapt/schema";

/**
 * Proposes temporary changes to the coming sessions for a constraint
 * ("traveling, hotel dumbbells only"). The browser sends the sessions as the
 * rule engine prescribes them; nothing here changes the program, and every
 * proposed change is checked in the browser before the lifter sees it.
 */

// Stable across requests so the prefix caches.
const SYSTEM = `You adjust a lifter's coming training sessions when life gets in the way: travel, a different gym, less time, missing equipment, feeling run down.

Rules:
- Change only what the constraint requires. Leave sessions it doesn't affect untouched.
- Keep each session's intent: replace a lift with the closest available movement (same pattern, same main muscles), using only equipment the gym has. Use library ids exactly.
- Never add volume: a swap keeps or lowers the sets, and "reduce" only lowers them.
- Prefer "reduce" for less time and "skip" for accessories before touching main lifts.
- Don't set weights. Code sets them from the lifter's log.
- If pain or injury is mentioned: don't program around it. Only skip or reduce the lift that hurts, say so plainly, and use safety_note to suggest seeing a professional.
- If the constraint can't be met, do the closest thing and say what's lost in the summary.`;

function unavailable(message: string, status = 503) {
  return Response.json({ status: "unavailable", message } satisfies AdaptReply, { status });
}

export async function POST(request: Request) {
  const body = AdaptRequest.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Expected { constraint, gym, sessions, library }." }, { status: 400 });
  const { constraint, gym, sessions, library } = body.data;

  const lines = [
    `Constraint: ${constraint}`,
    gym ? `Gym: ${gym.name}. Equipment: ${gym.equipment.join(", ")}.${gym.maxDumbbell !== null ? ` Dumbbells up to ${gym.maxDumbbell} lb.` : ""}` : "Gym: their usual one.",
    "",
    "Coming sessions:",
    ...sessions.flatMap((s) => [
      `Position ${s.position} · Day ${s.day}`,
      ...s.slots.map((x) => `- ${x.slot_key}: ${x.exercise} ${x.scheme}${x.weight !== null ? ` @ ${x.weight} lb` : ""} (${x.equipment}, ${x.pattern})`),
    ]),
    "",
    "Library (id: name · equipment · pattern · muscles):",
    ...library.map((e) => `${e.id}: ${e.name} · ${e.equipment} · ${e.pattern} · ${e.muscles.join("/")}`),
  ];

  try {
    const client = new Anthropic();
    const response = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      // Policy declines (unlikely here) retry on Anthropic's recommended model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(AdaptProposal) },
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: lines.join("\n") }],
    });
    if (response.stop_reason === "refusal") return unavailable("The AI declined to adjust these sessions.", 502);
    if (!response.parsed_output) return unavailable("The AI returned an unreadable answer. Try again.", 502);
    return Response.json({ status: "ok", proposal: response.parsed_output } satisfies AdaptReply);
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      return unavailable("Bend the week is off: the Anthropic credentials were rejected.");
    }
    if (error instanceof Anthropic.RateLimitError) return unavailable("Bend the week is busy. Try again in a minute.", 429);
    if (error instanceof Anthropic.APIError) return unavailable(`Adjusting the week failed (${error.status ?? "network"}).`, 502);
    // Most often: no API key, token or profile (the SDK throws a plain Error before sending).
    console.error("[adapt-week]", error);
    return unavailable("Bending the week needs an Anthropic API key on the server (see .env.example).");
  }
}
