import type { CallModel, ContentBlock } from "./loop";

/**
 * A scripted stand-in for the model, for when Ask has no API key (local
 * development, or a deployment without one). Only the model's side is
 * scripted: the tool calls run for real on the sample data, and the answer
 * goes through the same number check as a live one. The UI labels it.
 */

export const EXAMPLE_QUESTION = "Why did my bench stall?";

const toolCall = (id: string, name: string, input: unknown) => ({ type: "tool_use", id, name, input }) as unknown as ContentBlock;

const ROUNDS: ContentBlock[][] = [
  [
    toolCall("toolu_ex1", "find_plateaus", { min_weeks: 6 }),
    toolCall("toolu_ex2", "lift_trend", { exercise_id: "bench-press", from: "2026-06-01", to: null }),
  ],
  [
    toolCall("toolu_ex3", "weekly_sets", { muscle: "chest", exercise_id: null, from: "2026-06-01", to: null }),
    toolCall("toolu_ex4", "compare_periods", {
      metric: "weekly_sets",
      exercise_id: null,
      muscle: "chest",
      period_a: { from: "2026-06-01", to: "2026-08-09" },
      period_b: { from: "2026-08-10", to: "2026-10-16" },
    }),
    toolCall("toolu_ex5", "training_frequency", { from: "2026-06-01", to: null }),
  ],
  [
    toolCall("toolu_ex6", "show_answer", {
      charts: [
        { result_id: "r2", title: "Bench press · estimated 1RM", highlight: { from: "2026-08-03", to: "2026-10-12", label: "No new best" } },
        { result_id: "r3", title: "Weekly chest sets", highlight: { from: "2026-08-10", to: "2026-10-12", label: "3-day weeks" } },
      ],
      answer: [
        { text: "Your bench climbed steadily from June and peaked at 232 lb (205 × 4) in early August.", evidence: { result_id: "r2", from: "2026-06-01", to: "2026-08-09" } },
        { text: "It hasn’t set a new best in the 10 weeks since.", evidence: { result_id: "r1", from: null, to: null } },
        { text: "That’s when your chest volume dropped from about 14 to 8 sets a week,", evidence: { result_id: "r4", from: null, to: null } },
        { text: "as you went from 4 training days a week to 3.", evidence: { result_id: "r5", from: "2026-07-27", to: "2026-08-23" } },
        { text: "Your top sets didn’t get lighter, so lost volume is a likelier cause than effort.", evidence: { result_id: "r2", from: "2026-08-10", to: null } },
      ],
      caveat: "This is a pattern in your log, not proof of cause.",
      suggestion: "Bring chest work back toward 12 sets a week, for example 3 sets of incline dumbbell press on your B days.",
      follow_ups: ["Is my overhead press stalling too?", "Compare June and September", "Show all bench PRs"],
    }),
  ],
];

export function exampleModel(): CallModel {
  const rounds = [...ROUNDS];
  return async () => {
    await new Promise((r) => setTimeout(r, 700)); // pace it like a real round trip
    const content = rounds.shift();
    if (!content) return { content: [{ type: "text", text: "The scripted example only covers one question." } as ContentBlock], stop_reason: "end_turn" };
    return { content, stop_reason: "tool_use" };
  };
}
