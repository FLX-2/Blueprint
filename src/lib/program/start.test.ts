import { describe, expect, it } from "vitest";
import { athlete, exerciseById, program } from "@/data/seed";
import { sampleDataset } from "@/lib/dataset/dataset";
import { prescribe } from "@/lib/engine/engine";
import { initialState, startInputs } from "./start";

describe("startInputs", () => {
  const inputs = startInputs(program, sampleDataset, athlete, exerciseById);

  it("asks once per slot (tier + exercise)", () => {
    expect(inputs).toHaveLength(10);
    expect(new Set(inputs.map((i) => i.key)).size).toBe(10);
  });

  it("suggests an easy first week from the log", () => {
    const benchT1 = inputs.find((i) => i.key === "T1:bench-press")!;
    // Best est. 1RM 232 → 3-rep max ≈ 211 → 90% ≈ 190
    expect(benchT1.suggestion).toBe(190);
    expect(benchT1.basis).toMatch(/232 lb/);
  });

  it("leaves lifts without recent history blank", () => {
    const empty = { ...sampleDataset, sessions: [] };
    expect(startInputs(program, empty, athlete, exerciseById).every((i) => i.suggestion === null && i.basis === null)).toBe(true);
  });
});

describe("initialState", () => {
  it("feeds the engine's first prescription", () => {
    const state = initialState(program, { "T1:back-squat": 225 });
    const [squat, bench] = prescribe(program, program.days[0], state, athlete);
    expect(squat.sets?.[0]).toEqual({ weight: 225, reps: 3, amrap: false });
    expect(bench.sets).toBeNull();
  });
});

describe("bodyweight lifts", () => {
  it("start at 0 lb of added weight", () => {
    const withPullUps = { ...program, days: [{ ...program.days[0], slots: [{ exerciseId: "pull-up", tier: "T3" as const, scheme: { sets: 3, reps: 15, amrapLast: true } }] }] };
    const [input] = startInputs(withPullUps, sampleDataset, athlete, exerciseById);
    expect(input).toMatchObject({ bodyweight: true, suggestion: 0 });
  });
});
