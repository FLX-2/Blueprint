import { describe, expect, it } from "vitest";
import { sampleDataset } from "@/lib/dataset/dataset";
import { emptyThread, runTurn, type CallModel, type ContentBlock, type MessageParam } from "./loop";
import { numbersIn } from "./verify";

const toolUse = (id: string, name: string, input: unknown) => ({ type: "tool_use", id, name, input }) as unknown as ContentBlock;

/** A scripted stand-in for Claude: returns the next reply each call and records what it was sent. */
function script(replies: ContentBlock[][]) {
  const sent: MessageParam[][] = [];
  const call: CallModel = async (messages) => {
    sent.push(structuredClone(messages));
    const content = replies.shift();
    if (!content) throw new Error("script ran out");
    return { content, stop_reason: content.some((b) => b.type === "tool_use") ? "tool_use" : "end_turn" };
  };
  return { call, sent };
}

const answer = (text: string, resultId = "r1") =>
  toolUse("a1", "show_answer", {
    charts: [{ result_id: resultId, title: "Bench", highlight: null }],
    answer: [{ text, evidence: { result_id: resultId, from: null, to: null } }],
    caveat: null,
    suggestion: null,
    follow_ups: [],
  });

describe("numbersIn", () => {
  it("ignores dates, years and 1RM", () => {
    expect(numbersIn("Since Aug 10, 2026 your e1RM held at 232 lb (14 → 8 sets, 38.5%).")).toEqual(["232", "14", "8", "38.5"]);
  });
});

describe("runTurn", () => {
  it("runs tools locally, sends only their results, and shows a verified answer", async () => {
    const { call, sent } = script([
      [toolUse("t1", "lift_trend", { exercise_id: "bench-press", from: "2026-06-01", to: null })],
      [answer("Your best was 232 lb, from 205 × 4.")],
    ]);
    const steps: string[] = [];
    const { thread, outcome } = await runTurn({
      thread: emptyThread(),
      question: "Why did my bench stall?",
      preamble: "Data: sample",
      data: sampleDataset,
      callModel: call,
      onStep: (s) => steps.push(s.label),
    });

    expect(outcome.status).toBe("answered");
    if (outcome.status !== "answered") return;
    expect(outcome.answer.check.problems).toEqual([]);
    expect(steps[0]).toMatch(/^Estimated 1RM per week · Bench Press/);

    // Second request: the assistant turn went back unchanged, followed by the tool result.
    const second = sent[1];
    expect(second[1]).toEqual({ role: "assistant", content: [toolUse("t1", "lift_trend", { exercise_id: "bench-press", from: "2026-06-01", to: null })] });
    const result = (second[2].content as Array<{ type: string; content: string }>)[0];
    expect(result.type).toBe("tool_result");
    expect(JSON.parse(result.content).summary.best.best_e1rm).toBe(232);

    // The show_answer acknowledgement is held for the next question.
    expect(thread.pendingAck).toHaveLength(1);
  });

  it("sends unsupported numbers back once, then flags what's still unverified", async () => {
    const { call, sent } = script([
      [toolUse("t1", "lift_trend", { exercise_id: "bench-press", from: "2026-06-01", to: null })],
      [answer("Your bench is up 999 lb.")],
      [answer("Your bench is up 777 lb.")],
    ]);
    const { outcome } = await runTurn({ thread: emptyThread(), question: "q", data: sampleDataset, callModel: call });

    const feedback = (sent[2].at(-1)!.content as Array<{ is_error?: boolean; content: string }>)[0];
    expect(feedback.is_error).toBe(true);
    expect(feedback.content).toMatch(/999/);
    expect(outcome.status).toBe("answered");
    if (outcome.status === "answered") expect(outcome.answer.check.unverified).toEqual({ 0: ["777"] });
  });

  it("puts the previous answer's acknowledgement before a follow-up question", async () => {
    const first = script([[toolUse("t1", "lift_trend", { exercise_id: "bench-press", from: null, to: null })], [answer("Best 232 lb.")]]);
    const turn1 = await runTurn({ thread: emptyThread(), question: "q1", data: sampleDataset, callModel: first.call });
    const second = script([[{ type: "text", text: "Sure." } as ContentBlock]]);
    await runTurn({ thread: turn1.thread, question: "q2", data: sampleDataset, callModel: second.call });

    const lastUser = second.sent[0].at(-1)!.content as Array<{ type: string }>;
    expect(lastUser.map((b) => b.type)).toEqual(["tool_result", "text"]);
  });

  it("leaves the thread unchanged when the request fails", async () => {
    const thread = emptyThread();
    const { thread: after, outcome } = await runTurn({
      thread,
      question: "q",
      data: sampleDataset,
      callModel: async () => {
        throw new Error("Ask needs an API key.");
      },
    });
    expect(outcome).toMatchObject({ status: "error", message: "Ask needs an API key." });
    expect(after.messages).toEqual([]);
  });
});

describe("scripted example", () => {
  it("passes the same number check as a live answer on the sample data", async () => {
    const { exampleModel, EXAMPLE_QUESTION } = await import("./example-script");
    const { outcome } = await runTurn({ thread: emptyThread(), question: EXAMPLE_QUESTION, data: sampleDataset, callModel: exampleModel() });
    expect(outcome.status).toBe("answered");
    if (outcome.status === "answered") expect(outcome.answer.check).toEqual({ unverified: {}, problems: [] });
  }, 10_000);
});
