import { describe, expect, it } from "vitest";
import { exerciseById, exercises } from "@/data/seed";
import { decisionFrom, groupDecisions, guessEquipment, newTarget, resolveDecisions } from "./decisions";
import { matchName, type Suggestion } from "./match";

const decide = (name: string, sets = 10) => decisionFrom(matchName(name, exercises), sets);

describe("decisionFrom", () => {
  it("starts exact matches confirmed and spelling guesses unconfirmed", () => {
    expect(decide("Bench Press (Barbell)").confirmed).toBe(true);
    expect(decide("Flat Bench (BB)").confirmed).toBe(false);
  });

  it("leaves unmatched names unconfirmed, as a new exercise", () => {
    const d = decide("military press");
    expect(d.confirmed).toBe(false);
    expect(d.target).toMatchObject({ kind: "new", name: "Military Press" });
  });

  it("auto-confirms confident AI answers only", () => {
    const ai = (confidence: number): Suggestion => ({ name: "Military Press", exerciseId: "overhead-press", confidence, method: "ai" });
    expect(decisionFrom(ai(0.95), 5).confirmed).toBe(true);
    expect(decisionFrom(ai(0.7), 5).confirmed).toBe(false);
  });
});

describe("groupDecisions", () => {
  it("groups names by target and puts unconfirmed groups first", () => {
    const groups = groupDecisions(
      [decide("Bench Press (Barbell)"), decide("BB Bench"), decide("Flat Bench (BB)"), decide("Deadlifts")],
      exerciseById,
    );
    const bench = groups.find((g) => g.key === "lib:bench-press")!;
    expect(bench.members.map((m) => m.name)).toEqual(["Bench Press (Barbell)", "BB Bench", "Flat Bench (BB)"]);
    expect(bench.confirmed).toBe(false);
    expect(groups[0].key).toBe("lib:bench-press");
  });
});

describe("resolveDecisions", () => {
  it("maps library names and creates one custom exercise per new target, keeping spellings as aliases", () => {
    const draft = { name: "Cable Lateral Raise", pattern: "accessory" as const, muscles: ["shoulders" as const] };
    const a = { ...decide("cable laterals"), target: newTarget("cable laterals", draft), confirmed: true };
    const b = { ...decide("Cable Side Raise"), target: newTarget("Cable Side Raise", draft), confirmed: true };
    const { exerciseIdFor, customExercises } = resolveDecisions([decide("OHP"), a, b]);

    expect(exerciseIdFor("OHP")).toBe("overhead-press");
    expect(exerciseIdFor("cable laterals")).toBe(exerciseIdFor("Cable Side Raise"));
    expect(customExercises).toEqual([
      {
        id: "custom-cable-lateral-raise",
        name: "Cable Lateral Raise",
        aliases: ["cable laterals", "Cable Side Raise"],
        pattern: "accessory",
        muscles: ["shoulders"],
        equipment: "cable",
        body: "upper",
      },
    ]);
  });
});

describe("guessEquipment", () => {
  it.each([
    ["Incline DB Bench", "dumbbell"],
    ["Rope Pushdown", "cable"],
    ["Smith Machine Squat", "machine"],
    ["Weighted Pull-Up", "bodyweight"],
    ["EZ Curl", "barbell"],
  ])("%s → %s", (name, equipment) => {
    expect(guessEquipment(name)).toBe(equipment);
  });
});
