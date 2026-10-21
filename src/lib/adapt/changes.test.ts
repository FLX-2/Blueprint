import { describe, expect, it } from "vitest";
import { athlete, exerciseById, gyms, program, sessions } from "@/data/seed";
import { stateFromHistory } from "@/lib/engine/engine";
import { applyChanges, checkProposals, effectsOf, explainAdjusted, mentionsPain, quoteConstraint, toAdjustments, upcomingSessions, type ProposedChange } from "./changes";
import type { RuleEvent } from "@/lib/engine/engine";
import { EXAMPLE_PROPOSALS } from "./example";

const { state } = stateFromHistory({ program, sessions, exercises: exerciseById, athlete });
const hotel = gyms.find((g) => g.id === "hotel")!;
const upcoming = upcomingSessions(program, state, 3, athlete); // B2, A1, B1, A2
const end = "2026-10-16";
const check = (proposals: ProposedChange[], gym = hotel) =>
  checkProposals({ proposals, upcoming, exercises: exerciseById, gym, sessions, end, athlete });
const p = (o: Partial<ProposedChange>): ProposedChange => ({
  position: 0,
  slot_key: "T1:deadlift",
  kind: "swap",
  exercise_id: "goblet-squat",
  sets: 4,
  reps: 8,
  amrap_last: false,
  reason: "r",
  ...o,
});

describe("upcomingSessions", () => {
  it("lists the next rotation from the current day", () => {
    expect(upcoming.map((u) => u.day.id)).toEqual(["B2", "A1", "B1", "A2"]);
  });
});

describe("checkProposals", () => {
  it("accepts the scripted travel week except the impossible reduction", () => {
    const { accepted, rejected } = check(EXAMPLE_PROPOSALS);
    expect(accepted).toHaveLength(7);
    expect(rejected.map((r) => r.why)).toEqual(["Fewer sets has to be between 1 and 2."]);
  });

  it("rejects exercises the gym can't do, unknown ids, missing slots and duplicates", () => {
    const { rejected } = check([
      p({ exercise_id: "seated-cable-row" }),
      p({ exercise_id: "kettlebell-snatch" }),
      p({ slot_key: "T1:bench-press" }),
      p({ position: 9 }),
      p({}),
      p({}),
    ]);
    expect(rejected.map((r) => r.why)).toEqual([
      "Hotel gym has no cable for Seated Cable Row.",
      "“kettlebell-snatch” isn’t in the exercise library.",
      "Day B2 has no T1:bench-press.",
      "It refers to a session that isn’t coming up.",
      "A second change to the same exercise on the same day.",
    ]);
  });

  it("warns when a swap trains different muscles", () => {
    const { accepted } = check([p({ exercise_id: "lateral-raise" })]);
    expect(accepted[0].warnings).toEqual(["Lateral Raise trains different muscles than Deadlift."]);
  });

  it("sets swap weights from the log, capped at the gym's heaviest dumbbell", () => {
    const { accepted } = check([p({ slot_key: "T3:dumbbell-row", exercise_id: "incline-db-press", sets: 3, reps: 10 })], { ...hotel, maxDumbbell: 30 });
    expect(accepted[0].change).toMatchObject({ kind: "swap", weight: 30 });
    const bodyweight = check([p({ position: 1, slot_key: "T3:lat-pulldown", exercise_id: "pull-up" })]);
    expect(bodyweight.accepted[0].change).toMatchObject({ weight: 0 });
  });

  it("estimates from the replaced lift when the substitute isn't in the log, and says so", () => {
    const { accepted } = check([p({ position: 1, slot_key: "T2:bench-press", exercise_id: "dumbbell-bench-press", sets: 3, reps: 10 })], { ...hotel, maxDumbbell: 120 });
    const change = accepted[0].change;
    expect(change).toMatchObject({ kind: "swap", estimatedFrom: "Bench Press" });
    if (change.kind !== "swap") throw new Error("expected a swap");
    // Per-hand dumbbells: well under the barbell's working weight, in loadable steps.
    expect(change.weight).toBeGreaterThan(40);
    expect(change.weight).toBeLessThan(90);
    expect(change.weight! % 5).toBe(0);
  });
});

describe("applyChanges", () => {
  const b2 = upcoming[0].prescriptions;
  it("swaps the exercise and scheme, trims sets, and marks skips", () => {
    const out = applyChanges(b2, [
      { slotKey: "T1:deadlift", kind: "swap", exerciseId: "goblet-squat", scheme: { sets: 4, reps: 10, amrapLast: false }, weight: 50, reason: "" },
      { slotKey: "T2:overhead-press", kind: "reduce", sets: 2, reason: "" },
      { slotKey: "T3:dumbbell-row", kind: "skip", reason: "" },
    ]);
    expect(out[0]).toMatchObject({ key: "T1:goblet-squat~swap", scheme: "4×10", slot: { exerciseId: "goblet-squat" } });
    expect(out[0].sets).toHaveLength(4);
    expect(out[1].sets).toHaveLength(2);
    expect(out[2].change?.kind).toBe("skip");
  });
});

describe("effectsOf", () => {
  it("counts sets per muscle before and after, and lists lifts that pause", () => {
    const { accepted } = check(EXAMPLE_PROPOSALS);
    const effects = effectsOf(upcoming, accepted, exerciseById);
    const back = effects.muscles.find((m) => m.muscle === "back");
    expect(back!.after).toBeLessThan(back!.before); // deadlifts and pulldowns swapped for leg and bodyweight work
    expect(effects.paused).toContain("Deadlift (T1)");
    expect(effects.paused).not.toContain("Dumbbell Row (T3)");
  });
});

describe("toAdjustments", () => {
  it("groups changes by day, leaving untouched days out", () => {
    const { accepted } = check(EXAMPLE_PROPOSALS);
    expect(toAdjustments(accepted, upcoming, "travel", "adj").map((a) => [a.dayId, a.changes.length])).toEqual([
      ["B2", 2],
      ["A1", 3],
      ["B1", 2],
    ]);
  });
});

describe("mentionsPain", () => {
  it.each([
    ["My shoulder hurts on overhead press", true],
    ["tweaked my back", true],
    ["short on time this week", false],
  ])("%s → %s", (text, expected) => {
    expect(mentionsPain(text)).toBe(expected);
  });
});

describe("explainAdjusted", () => {
  it("says a swapped lift held on purpose, and leaves other events alone", () => {
    const slot = { stage: 0, weight: 350 } as unknown as RuleEvent["from"];
    const events: RuleEvent[] = [
      { key: "T1:deadlift", kind: "skipped", message: "Deadlift wasn’t logged, so nothing changes.", from: slot, to: slot },
      { key: "T3:dumbbell-row", kind: "skipped", message: "Dumbbell Row wasn’t logged, so nothing changes.", from: slot, to: slot },
    ];
    const adjustment = toAdjustments(check([p({})]).accepted, upcoming, "travel", "adj")[0];
    const [deadlift, row] = explainAdjusted(events, adjustment, exerciseById, (key) => key.split(":")[1]);
    expect(deadlift).toMatchObject({ swapped: true, message: "Swapped for Goblet Squat this time, so Deadlift stays at 350 lb." });
    expect(row).toEqual(events[1]);
  });
});

describe("quoteConstraint", () => {
  it("drops closing punctuation so the quote sits inside a sentence", () => {
    expect(quoteConstraint(" No barbells. ")).toBe("“No barbells”");
  });
});
