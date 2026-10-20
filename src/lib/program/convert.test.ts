import { describe, expect, it } from "vitest";
import { exercises } from "@/data/seed";
import { draftFrom, draftIssues, locate, programFrom, toRule } from "./convert";
import { EXAMPLE_EXTRACTION, EXAMPLE_PROGRAM_TEXT } from "./example";
import type { ExtractedRule } from "./extract-schema";

const empty: ExtractedRule = {
  tier: "T1",
  kind: "linear",
  increment_upper: null,
  increment_lower: null,
  rep_target: null,
  rep_min: null,
  rep_max: null,
  stages: null,
  reset: null,
  cycle_weeks: null,
  confidence: 0.95,
  reason: "",
  source_quote: "",
};

describe("locate", () => {
  const text = "T1 is 5x3+ at roughly 85%.\n\nHit every rep and add   10lb for lower body.";
  it("finds exact quotes", () => {
    expect(locate(text, "5x3+")).toEqual({ start: 6, end: 10 });
  });
  it("tolerates whitespace, case and curly quotes", () => {
    const span = locate(text, "hit every rep and add 10LB")!;
    expect(text.slice(span.start, span.end)).toBe("Hit every rep and add   10lb");
    expect(locate("It’s the “last” set", 'it\'s the "last"')).not.toBeNull();
  });
  it("returns null when the quote isn't in the source", () => {
    expect(locate(text, "deload every fourth week")).toBeNull();
  });
});

describe("toRule", () => {
  it("builds a linear rule, and explains a missing jump", () => {
    expect(toRule({ ...empty, increment_upper: 5, increment_lower: 10 }, "r").rule).toMatchObject({ kind: "linear", increment: { upper: 5, lower: 10 } });
    expect(toRule(empty, "r")).toEqual({ rule: null, issues: ["The weight jump isn’t clear."] });
  });

  it("normalizes percentages given as whole numbers", () => {
    const { rule } = toRule(
      {
        ...empty,
        kind: "stage-on-failure",
        stages: [
          { sets: 3, reps: 10, amrap_last: false },
          { sets: 3, reps: 8, amrap_last: false },
        ],
        reset: { sets: 3, reps: 10, amrap_last: false, percent_of: "last-weight", percent: 85 },
      },
      "r",
    );
    expect(rule).toMatchObject({ reset: { percent: 0.85 } });
  });

  it("rejects a double progression with a backwards range", () => {
    expect(toRule({ ...empty, kind: "double-progression", increment_upper: 5, increment_lower: 5, rep_min: 12, rep_max: 8 }, "r").rule).toBeNull();
  });

  it("never runs what it can't represent", () => {
    expect(toRule({ ...empty, kind: "unsupported" }, "r").rule).toBeNull();
  });

  it("starts every rule as proposed", () => {
    expect(toRule({ ...empty, increment_upper: 5, increment_lower: 10 }, "r").rule?.status).toBe("proposed");
  });
});

describe("the GZCLP example", () => {
  const draft = draftFrom(EXAMPLE_EXTRACTION, EXAMPLE_PROGRAM_TEXT, exercises);

  it("finds every quote in the source", () => {
    expect(draft.rules.every((r) => r.span)).toBe(true);
    expect(draft.days.flatMap((d) => d.slots).every((s) => s.span)).toBe(true);
  });

  it("matches exercise names to the library", () => {
    const names = draft.days[1].slots.map((s) => s.exerciseId);
    expect(names).toEqual(["overhead-press", "deadlift", "dumbbell-row"]);
  });

  it("flags the uncertain rules and the either/or exercise, nothing else", () => {
    const { blocking, warnings } = draftIssues(draft);
    expect(blocking.map((b) => b.label)).toEqual([
      "A1 · Lat pulldown",
      "A2 · Lat pulldown",
      "T1 · stage on failure",
      "T2 · stage on failure",
    ]);
    expect(warnings).toEqual([]);
  });

  it("builds a runnable program with only confirmed rules", () => {
    const reviewed = {
      ...draft,
      days: draft.days.map((d) => ({ ...d, slots: d.slots.map((s) => ({ ...s, exerciseId: s.exerciseId ?? "lat-pulldown", confirmed: true })) })),
      rules: draft.rules.map((r) => (r.tier === "T2" && r.rule?.kind === "stage-on-failure" ? r : { ...r, confirmed: true })),
    };
    const program = programFrom(reviewed, "p1");
    expect(program.days[0].slots[2]).toEqual({ exerciseId: "lat-pulldown", tier: "T3", scheme: { sets: 3, reps: 15, amrapLast: true } });
    expect(program.rules.map((r) => `${r.tier} ${r.kind} ${r.status}`)).toEqual([
      "T1 linear confirmed",
      "T1 stage-on-failure confirmed",
      "T2 linear confirmed",
      "T3 amrap-threshold confirmed",
    ]);
    expect(program.rules[0].source).toBeDefined();
  });

  it("warns when a tier has nothing to progress it", () => {
    const noT3 = { ...draft, rules: draft.rules.filter((r) => r.tier !== "T3") };
    expect(draftIssues(noT3).warnings[0]).toMatch(/^T3 has no progression rule/);
  });
});

describe("segmentSource", async () => {
  const { segmentSource } = await import("./source-segments");
  const text = "T2 OHP, T3 DB row.";
  const marks = [
    { id: "ohp", span: { start: 0, end: 6 }, flagged: false },
    { id: "row", span: { start: 0, end: 18 }, flagged: true },
  ];
  it("gives overlapping text to the shortest quote", () => {
    expect(segmentSource(text, marks, null).map((s) => [s.text, s.mark?.id])).toEqual([
      ["T2 OHP", "ohp"],
      [", T3 DB row.", "row"],
    ]);
  });
  it("lets the selected quote take over its whole span", () => {
    expect(segmentSource(text, marks, "row").map((s) => [s.text, s.mark?.id, s.selected])).toEqual([["T2 OHP, T3 DB row.", "row", true]]);
  });
});
