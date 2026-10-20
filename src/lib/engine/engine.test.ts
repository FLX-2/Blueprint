import { describe, expect, it } from "vitest";
import { athlete, exerciseById, getExercise, program as gzclp, sessions } from "@/data/seed";
import type { Program, Rule, SetLog, SetScheme } from "@/lib/domain/types";
import { applySession, applySlot, inferStage, prescribe, rulesFor, slotKey, stateFromHistory, type SlotState } from "./engine";

const s = (sets: number, reps: number, amrapLast = false): SetScheme => ({ sets, reps, amrapLast });
const log = (exerciseId: string, weight: number, reps: number[]): SetLog[] =>
  reps.map((r, setIndex) => ({ exerciseId, setIndex, weight, reps: r }));

const squatT1 = gzclp.days[0].slots[0]; // A1 · T1 back squat 5×3+
const benchT2 = gzclp.days[0].slots[1]; // A1 · T2 bench 3×10
const pulldownT3 = gzclp.days[0].slots[2]; // A1 · T3 lat pulldown 3×15+

const apply = (slot: typeof squatT1, state: SlotState, performed: SetLog[], program: Program = gzclp) =>
  applySlot({ program, slot, exercise: getExercise(slot.exerciseId), state, performed, athlete });

describe("GZCLP T1 (linear + stage on failure)", () => {
  it("adds 10 lb to a lower-body lift when every rep is hit", () => {
    const { state, event } = apply(squatT1, { weight: 225, stage: 0 }, log("back-squat", 225, [3, 3, 3, 3, 6]));
    expect(state).toEqual({ weight: 235, stage: 0 });
    expect(event).toMatchObject({ kind: "progressed", message: "All reps hit: 235 lb next time." });
  });

  it("steps 5×3 → 6×2 → 10×1 at the same weight on misses", () => {
    const first = apply(squatT1, { weight: 225, stage: 0 }, log("back-squat", 225, [3, 3, 3, 2, 2]));
    expect(first.state).toEqual({ weight: 225, stage: 1 });
    expect(first.event.message).toBe("Missed reps: switch to 6×2+ at 225 lb.");

    const second = apply(squatT1, first.state, log("back-squat", 225, [2, 2, 2, 2, 1, 1]));
    expect(second.state).toEqual({ weight: 225, stage: 2 });
  });

  it("keeps progressing at a later stage once reps are hit again", () => {
    const { state } = apply(squatT1, { weight: 225, stage: 1 }, log("back-squat", 225, [2, 2, 2, 2, 2, 4]));
    expect(state).toEqual({ weight: 235, stage: 1 });
  });

  it("resets to 85% of an estimated 5RM after failing the last stage, and asks for a retest", () => {
    const { state, event } = apply(squatT1, { weight: 245, stage: 2 }, log("back-squat", 245, [1, 1, 1, 1, 1, 1, 1, 0, 0, 0]));
    // Best set 245 × 1 → e1RM 245 → 5RM ≈ 210 → 85% ≈ 178.5 → 175 (rounded down to a 5 lb jump)
    expect(state).toEqual({ weight: 175, stage: 0 });
    expect(event).toMatchObject({ kind: "reset", needsRetest: true });
  });
});

describe("GZCLP T2 (linear + reset to a share of the last weight)", () => {
  it("adds 5 lb to an upper-body lift", () => {
    expect(apply(benchT2, { weight: 135, stage: 0 }, log("bench-press", 135, [10, 10, 10])).state.weight).toBe(140);
  });

  it("resets to 85% of the last weight after 3×6 fails", () => {
    const { state, event } = apply(benchT2, { weight: 150, stage: 2 }, log("bench-press", 150, [6, 5, 4]));
    expect(state).toEqual({ weight: 125, stage: 0 }); // 127.5 → 125
    expect(event.kind).toBe("reset");
    expect(event.needsRetest).toBeUndefined();
  });
});

describe("GZCLP T3 (AMRAP threshold)", () => {
  it("holds until the last set reaches 25, then adds weight", () => {
    expect(apply(pulldownT3, { weight: 80, stage: 0 }, log("lat-pulldown", 80, [15, 15, 22])).event).toMatchObject({
      kind: "held",
      message: "Last set hit 22 of 25: same weight next time.",
    });
    expect(apply(pulldownT3, { weight: 80, stage: 0 }, log("lat-pulldown", 80, [15, 15, 25])).state.weight).toBe(85);
  });
});

describe("other progression kinds", () => {
  const base = { status: "confirmed", confidence: 1 } as const;
  const dp: Program = {
    id: "dp",
    name: "Double progression",
    days: [{ id: "D", name: "D", slots: [{ exerciseId: "dumbbell-row", tier: "T1", scheme: s(3, 8) }] }],
    rules: [{ ...base, id: "dp", tier: "T1", kind: "double-progression", repRange: { min: 8, max: 12 }, increment: { upper: 5, lower: 10 } }],
  };
  const slot = dp.days[0].slots[0];

  it("double progression adds a rep, then weight at the top of the range", () => {
    const up = apply(slot, { weight: 50, stage: 0, reps: 9 }, log("dumbbell-row", 50, [9, 9, 9]), dp);
    expect(up.state).toEqual({ weight: 50, stage: 0, reps: 10 });
    const top = apply(slot, { weight: 50, stage: 0, reps: 12 }, log("dumbbell-row", 50, [12, 12, 12]), dp);
    expect(top.state).toEqual({ weight: 55, stage: 0, reps: 8 });
    expect(prescribe(dp, dp.days[0], { [slotKey(slot)]: { weight: 50, stage: 0, reps: 10 } }, athlete)[0].scheme).toBe("3×10");
  });

  const wendler: Program = {
    id: "531",
    name: "5/3/1",
    days: [{ id: "D", name: "D", slots: [{ exerciseId: "deadlift", tier: "T1", scheme: s(3, 5, true) }] }],
    rules: [
      {
        ...base,
        id: "cycle",
        tier: "T1",
        kind: "percentage-cycle",
        weeks: [
          { sets: [{ percent: 0.65, reps: 5, amrap: false }, { percent: 0.75, reps: 5, amrap: false }, { percent: 0.85, reps: 5, amrap: true }] },
          { sets: [{ percent: 0.7, reps: 3, amrap: false }, { percent: 0.8, reps: 3, amrap: false }, { percent: 0.9, reps: 3, amrap: true }] },
          { sets: [{ percent: 0.75, reps: 5, amrap: false }, { percent: 0.85, reps: 3, amrap: false }, { percent: 0.95, reps: 1, amrap: true }] },
        ],
        increment: { upper: 5, lower: 10 },
      },
    ],
  };
  const dl = wendler.days[0].slots[0];

  it("percentage cycles prescribe from the training max and raise it after the last week", () => {
    const sets = prescribe(wendler, wendler.days[0], { [slotKey(dl)]: { weight: 0, stage: 0, cycleWeek: 1, trainingMax: 400 } }, athlete)[0].sets;
    expect(sets).toEqual([
      { weight: 280, reps: 3, amrap: false },
      { weight: 320, reps: 3, amrap: false },
      { weight: 360, reps: 3, amrap: true },
    ]);
    const end = apply(dl, { weight: 0, stage: 0, cycleWeek: 2, trainingMax: 400 }, log("deadlift", 380, [5, 3, 2]), wendler);
    expect(end.state).toMatchObject({ cycleWeek: 0, trainingMax: 410 });
    expect(end.event.kind).toBe("cycle");
  });
});

describe("safety rails", () => {
  it("never runs proposed rules", () => {
    const proposed: Program = { ...gzclp, rules: gzclp.rules.map((r): Rule => (r.tier === "T1" ? { ...r, status: "proposed" } : r)) };
    expect(rulesFor(proposed, "T1")).toEqual({ progression: undefined, failure: undefined });
    const { event } = apply(squatT1, { weight: 225, stage: 0 }, log("back-squat", 225, [3, 3, 3, 3, 5]), proposed);
    expect(event.kind).toBe("held");
  });

  it("leaves a skipped slot unchanged", () => {
    const { state, event } = apply(squatT1, { weight: 225, stage: 1 }, []);
    expect(state).toEqual({ weight: 225, stage: 1 });
    expect(event.kind).toBe("skipped");
  });

  it("asks for a starting weight when a slot has no state", () => {
    expect(prescribe(gzclp, gzclp.days[0], {}, athlete).every((p) => p.sets === null)).toBe(true);
  });
});

describe("inferStage", () => {
  const t2 = [s(3, 10), s(3, 8), s(3, 6)];
  it("reads 10, 10, 9 as a missed 3×10 and 8, 8, 7 as 3×8", () => {
    expect(inferStage(t2, log("x", 100, [10, 10, 9]))).toBe(0);
    expect(inferStage(t2, log("x", 100, [8, 8, 7]))).toBe(1);
  });
  it("prefers the planned reps when they were logged", () => {
    expect(inferStage(t2, [{ exerciseId: "x", setIndex: 0, weight: 100, reps: 7, targetReps: 8 }])).toBe(0); // set count differs → falls back
    expect(inferStage(t2, log("x", 100, [6, 6, 6]).map((x) => ({ ...x, targetReps: 6 })))).toBe(2);
  });
});

describe("on the sample athlete's log", () => {
  const { state, lastEvents } = stateFromHistory({ program: gzclp, sessions, exercises: exerciseById, athlete });

  it("has a next target for every slot that was trained", () => {
    for (const day of gzclp.days) for (const slot of day.slots) expect(state[slotKey(slot)]).toBeDefined();
  });

  it("moves bench T1 to 210 lb after the last 205 × 3+ session", () => {
    expect(state["T1:bench-press"]).toEqual({ weight: 210, stage: 0 });
    expect(lastEvents["T1:bench-press"]?.kind).toBe("progressed");
  });

  it("runs a whole day through applySession", () => {
    const day = gzclp.days[0];
    const { events } = applySession({
      program: gzclp,
      day,
      state,
      // Squat hits every rep; bench T2 badly misses (whatever stage it's at); pulldown isn't logged.
      sets: [...log("back-squat", state["T1:back-squat"].weight, [3, 3, 3, 3, 3]), ...log("bench-press", state["T2:bench-press"].weight, [1, 1, 1])],
      exercises: exerciseById,
      athlete,
    });
    expect(events.map((e) => e.kind)).toEqual(["progressed", expect.stringMatching(/^(stage-down|reset)$/), "skipped"]);
  });
});
