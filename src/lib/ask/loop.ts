import type Anthropic from "@anthropic-ai/sdk";
import type { Dataset } from "@/lib/dataset/dataset";
import { ToolInputs, type ShowAnswerInput } from "./tool-defs";
import { runTool, type ToolResult } from "./tools";
import { checkAnswer, type AnswerCheck } from "./verify";

/**
 * The Ask agent loop, run in the browser. The model runs on the server
 * (/api/ask); tools run here, on local data, and only their results are
 * sent back. The history is append-only: assistant turns go back exactly as
 * they came (thinking blocks included), which preserved thinking requires.
 */

export type MessageParam = Anthropic.Beta.Messages.BetaMessageParam;
export type ContentBlock = Anthropic.Beta.Messages.BetaContentBlock;
type ToolResultBlock = Anthropic.Beta.Messages.BetaToolResultBlockParam;

export type ModelReply = { content: ContentBlock[]; stop_reason: string | null };
export type CallModel = (messages: MessageParam[]) => Promise<ModelReply>;

export type Step = { id: string; label: string; ok: boolean };

export type Answer = { input: ShowAnswerInput; check: AnswerCheck };

export type Thread = {
  messages: MessageParam[];
  /** Tool results from every turn so far, by result id. */
  results: Record<string, ToolResult>;
  /** Acknowledgement for the last show_answer call; must lead the next user message. */
  pendingAck: ToolResultBlock[];
  nextId: number;
};

export type TurnOutcome =
  | { status: "answered"; answer: Answer; steps: Step[] }
  | { status: "text"; text: string; steps: Step[] }
  | { status: "error"; message: string; steps: Step[] };

export const emptyThread = (): Thread => ({ messages: [], results: {}, pendingAck: [], nextId: 1 });

const MAX_ROUNDS = 10;
const MAX_FIXES = 1;

export async function runTurn(opts: {
  thread: Thread;
  question: string;
  /** Facts about the dataset, sent with the first question only. */
  preamble?: string;
  data: Dataset;
  callModel: CallModel;
  onStep?: (step: Step) => void;
}): Promise<{ thread: Thread; outcome: TurnOutcome }> {
  const thread: Thread = { ...opts.thread, messages: [...opts.thread.messages], results: { ...opts.thread.results } };
  const steps: Step[] = [];
  const text = opts.preamble ? `${opts.preamble}\n\nQuestion: ${opts.question}` : opts.question;
  thread.messages.push({ role: "user", content: [...thread.pendingAck, { type: "text", text }] });
  thread.pendingAck = [];
  let fixes = 0;

  const done = (outcome: TurnOutcome) => ({ thread, outcome });

  for (let round = 0; round < MAX_ROUNDS; round++) {
    let reply: ModelReply;
    try {
      reply = await opts.callModel(thread.messages);
    } catch (error) {
      // Drop the unanswered question so the thread stays valid for a retry.
      thread.messages = opts.thread.messages;
      thread.pendingAck = opts.thread.pendingAck;
      return done({ status: "error", message: error instanceof Error ? error.message : "Ask failed.", steps });
    }
    thread.messages.push({ role: "assistant", content: reply.content as MessageParam["content"] });

    if (reply.stop_reason === "refusal") return done({ status: "error", message: "The AI declined to answer this.", steps });
    if (reply.stop_reason === "max_tokens") return done({ status: "error", message: "The answer ran too long.", steps });
    if (reply.stop_reason === "pause_turn") continue;

    const uses = reply.content.filter((b): b is Anthropic.Beta.Messages.BetaToolUseBlock => b.type === "tool_use");
    if (!uses.length) {
      const said = reply.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
      return done({ status: "text", text: said || "No answer came back.", steps });
    }

    const toolResults: ToolResultBlock[] = [];
    let answer: Answer | null = null;

    for (const use of uses) {
      if (use.name !== "show_answer") {
        const id = `r${thread.nextId++}`;
        const result = runTool(opts.data, use.name, use.input, id);
        thread.results[id] = result;
        const step = { id, label: result.label, ok: result.ok };
        steps.push(step);
        opts.onStep?.(step);
        toolResults.push({ type: "tool_result", tool_use_id: use.id, content: JSON.stringify(result.forModel), ...(result.ok ? {} : { is_error: true }) });
        continue;
      }

      const parsed = ToolInputs.show_answer.safeParse(use.input);
      if (!parsed.success) {
        toolResults.push({ type: "tool_result", tool_use_id: use.id, is_error: true, content: `Invalid answer: ${parsed.error.message}` });
        continue;
      }
      const check = checkAnswer(parsed.data, thread.results);
      if (check.problems.length && fixes < MAX_FIXES) {
        fixes++;
        toolResults.push({
          type: "tool_result",
          tool_use_id: use.id,
          is_error: true,
          content: `Not shown yet. ${check.problems.join(" ")} Get the numbers from a tool (compare_periods for differences), or leave them out, then call show_answer again.`,
        });
        continue;
      }
      answer = { input: parsed.data, check };
      toolResults.push({ type: "tool_result", tool_use_id: use.id, content: "Shown to the lifter." });
    }

    if (answer) {
      thread.pendingAck = toolResults;
      return done({ status: "answered", answer, steps });
    }
    thread.messages.push({ role: "user", content: toolResults });
  }
  return done({ status: "error", message: "The analysis took too many steps. Try a narrower question.", steps });
}
