import Anthropic from "@anthropic-ai/sdk";
import * as z from "zod/v4";
import { ASK_SYSTEM } from "@/lib/ask/system-prompt";
import { TOOL_DESCRIPTIONS, ToolInputs, type ToolName } from "@/lib/ask/tool-defs";
import { modelParams } from "@/lib/ai/model";

/**
 * One model step of the Ask loop. The browser runs the tools on the lifter's
 * local data and sends back only their results; this route never sees the
 * raw log. It is stateless: the browser sends the conversation each time.
 */

export type AskReply =
  | { status: "ok"; content: Anthropic.Beta.Messages.BetaContentBlock[]; stop_reason: string | null }
  | { status: "unavailable"; message: string };

const TOOLS: Anthropic.Beta.Messages.BetaTool[] = (Object.keys(ToolInputs) as ToolName[]).map((name) => {
  const schema = z.toJSONSchema(ToolInputs[name]) as Record<string, unknown>;
  delete schema.$schema;
  return {
    name,
    description: TOOL_DESCRIPTIONS[name],
    input_schema: schema as Anthropic.Beta.Messages.BetaTool["input_schema"],
    strict: true,
  };
});

const MAX_BODY_CHARS = 600_000;
const Body = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.array(z.record(z.string(), z.unknown())).min(1) }))
    .min(1)
    .max(80),
});

function unavailable(message: string, status = 503) {
  return Response.json({ status: "unavailable", message } satisfies AskReply, { status });
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > MAX_BODY_CHARS) return Response.json({ error: "Conversation too long. Start a new question." }, { status: 413 });
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    json = null;
  }
  const body = Body.safeParse(json);
  if (!body.success) return Response.json({ error: "Expected { messages: [...] }." }, { status: 400 });

  try {
    const client = new Anthropic();
    const response = await client.beta.messages.create({
      ...modelParams(),
      max_tokens: 16000,
      output_config: { effort: "medium" },
      system: [{ type: "text", text: ASK_SYSTEM, cache_control: { type: "ephemeral" } }],
      tools: TOOLS,
      // Caches the growing conversation across the loop's round trips.
      cache_control: { type: "ephemeral" },
      // Shape-checked above; the API validates the blocks themselves.
      messages: body.data.messages as unknown as Anthropic.Beta.Messages.BetaMessageParam[],
    });
    return Response.json({ status: "ok", content: response.content, stop_reason: response.stop_reason } satisfies AskReply);
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      return unavailable("Ask is off: the Anthropic credentials were rejected.");
    }
    if (error instanceof Anthropic.RateLimitError) return unavailable("Ask is busy. Try again in a minute.", 429);
    if (error instanceof Anthropic.BadRequestError) return unavailable(`Ask couldn’t process this conversation (${error.message}).`, 400);
    if (error instanceof Anthropic.APIError) return unavailable(`Ask failed (${error.status ?? "network"}).`, 502);
    // Most often: no API key, token or profile (the SDK throws a plain Error before sending).
    console.error("[ask]", error);
    return unavailable("Ask needs an Anthropic API key on the server (see .env.example).");
  }
}
