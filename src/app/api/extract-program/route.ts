import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";
import { ExtractedProgram } from "@/lib/program/extract-schema";
import { modelParams } from "@/lib/ai/model";

/**
 * Reads a pasted training program into structure: days, slots and
 * progression rules, each with a confidence and an exact source quote.
 * Nothing here runs; the browser checks the result and the lifter
 * confirms it (src/lib/program/convert.ts).
 */

export type ExtractReply = { status: "ok"; program: ExtractedProgram } | { status: "unavailable"; message: string };

const MAX_CHARS = 20_000;
const Body = z.object({ text: z.string().trim().min(20).max(MAX_CHARS) });

// Stable across requests so the prefix caches.
const SYSTEM = `You read strength-training programs that lifters paste from forums, PDFs and spreadsheets, and turn them into structure a rule engine can run.

Extract:
- Days in the order they rotate, and each day's exercise slots: the exercise as written, its tier, sets, reps, and whether the last set is AMRAP ("3+", "AMRAP").
- Progression rules per tier. A tier has one progression rule (linear, amrap-threshold, double-progression or percentage-cycle) and, optionally, a stage-on-failure rule for what happens after missed reps.

Tiers: group slots that progress the same way. Use the program's own tiers (T1/T2/T3) when it has them; otherwise put main lifts in T1 and accessories in T2 or T3. If everything progresses the same way, use T1 for all.

Be honest about gaps:
- Copy a short exact quote from the text for every slot and rule, so the lifter can see where it came from.
- When the text leaves something out (no number for a reset, a jump that isn't stated), fill it with the most common choice for that program, lower your confidence below 0.9, and say what you assumed in the reason.
- When a slot allows a choice ("lat pulldown or pull-ups"), list the other options in alternatives.
- If a progression scheme doesn't fit any kind, use "unsupported" and explain in the reason. Put anything else you couldn't represent in notes.
- Weights are in lb. Percentages are fractions (0.85).`;

function unavailable(message: string, status = 503) {
  return Response.json({ status: "unavailable", message } satisfies ExtractReply, { status });
}

export async function POST(request: Request) {
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: `Paste the program text (20 to ${MAX_CHARS.toLocaleString("en-US")} characters).` }, { status: 400 });

  try {
    const client = new Anthropic();
    const read = () =>
      client.beta.messages.parse({
        ...modelParams(),
        max_tokens: 16000,
        output_config: { effort: "medium", format: betaZodOutputFormat(ExtractedProgram) },
        system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: `Program text:\n<program>\n${body.data.text}\n</program>` }],
      });
    let response = await read();
    // A reading with workouts but no progression rules can't run itself. Smaller models
    // occasionally skip the rules entirely, so read once more before giving up on them.
    if (response.parsed_output && response.parsed_output.days.length && !response.parsed_output.rules.length) response = await read();

    if (response.stop_reason === "refusal") return unavailable("The AI declined to read this text.", 502);
    if (response.stop_reason === "max_tokens") return unavailable("This program is too long to read in one go. Try pasting one block at a time.", 413);
    if (!response.parsed_output) return unavailable("The AI returned an unreadable answer. Try again.", 502);
    return Response.json({ status: "ok", program: response.parsed_output } satisfies ExtractReply);
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      return unavailable("Program import is off: the Anthropic credentials were rejected.");
    }
    if (error instanceof Anthropic.RateLimitError) return unavailable("Program import is busy. Try again in a minute.", 429);
    if (error instanceof Anthropic.APIError) return unavailable(`Reading the program failed (${error.status ?? "network"}).`, 502);
    // Most often: no API key, token or profile (the SDK throws a plain Error before sending).
    console.error("[extract-program]", error);
    return unavailable("Reading a program needs an Anthropic API key on the server (see .env.example).");
  }
}
