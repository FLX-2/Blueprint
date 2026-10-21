import { describe, expect, it } from "vitest";
import { athlete, exerciseById, program, sessions } from "@/data/seed";
import { prescribe, stateFromHistory } from "@/lib/engine/engine";
import { finishSession, isComplete, logSet, moveTo, personalBests, REST_SECONDS, startSession, undoLast, type ActiveSession } from "./session";

const { state } = stateFromHistory({ program, sessions, exercises: exerciseById, athlete });
const day = program.days[0]; // A1: squat T1, bench T2, pulldown T3
const now = new Date("2026-10-20T07:00:00Z");
const start = () => startSession({ id: "s1", programId: program.id, day, prescriptions: prescribe(program, day, state, athlete), now });

/** Logs every remaining set at its target. */
function logAll(s: ActiveSession, reps?: (target: number, amrap: boolean) => number) {
  let t = now.getTime();
  while (!isComplete(s)) {
    const cur = s.slots[s.cursor.slot].sets[s.cursor.set];
    s = logSet(s, { weight: cur.weight, reps: reps ? reps(cur.targetReps, cur.amrap) : cur.targetReps }, (t += 60_000));
  }
  return s;
}

describe("logging a session", () => {
  it("starts from the engine's prescription", () => {
    const s = start();
    expect(s.slots.map((x) => [x.exerciseId, x.sets.length])).toEqual([
      ["back-squat", 5],
      ["bench-press", 3],
      ["lat-pulldown", 3],
    ]);
    expect(s.cursor).toEqual({ slot: 0, set: 0 });
  });

  it("moves to the next set and starts the tier's rest timer", () => {
    const s = logSet(start(), { weight: 335, reps: 3 }, now.getTime());
    expect(s.cursor).toEqual({ slot: 0, set: 1 });
    expect(s.restUntil).toBe(now.getTime() + REST_SECONDS.T1 * 1000);
  });

  it("carries a weight change to the rest of that exercise's sets", () => {
    const first = start();
    const target = first.slots[0].sets[0].weight;
    const s = logSet(first, { weight: target - 10, reps: 3 }, now.getTime());
    expect(s.slots[0].sets.map((x) => x.weight)).toEqual([target - 10, target - 10, target - 10, target - 10, target - 10]);
    expect(s.slots[1].sets[0].weight).toBe(first.slots[1].sets[0].weight);
  });

  it("undoes the last logged set", () => {
    const s = undoLast(logSet(start(), { weight: 335, reps: 3 }, now.getTime()));
    expect(s.cursor).toEqual({ slot: 0, set: 0 });
    expect(s.slots[0].sets[0].done).toBe(false);
  });

  it("can jump to another exercise and come back to unfinished sets", () => {
    let s = moveTo(start(), 2);
    s = logSet(s, { weight: s.slots[2].sets[0].weight, reps: 15 }, now.getTime());
    expect(s.cursor).toEqual({ slot: 2, set: 1 });
    s = moveTo(s, 0);
    expect(s.cursor).toEqual({ slot: 0, set: 0 });
  });
});

describe("finishing a session", () => {
  it("logs it, runs the rules, and summarizes", () => {
    const s = logAll(start(), (t, amrap) => (amrap ? t + 2 : t));
    const { logged, state: next, summary } = finishSession({
      session: s,
      program,
      state,
      exercises: exerciseById,
      athlete,
      history: sessions,
      date: "2026-10-20",
      now: new Date(now.getTime() + 62 * 60_000),
    });
    expect(logged).toMatchObject({ date: "2026-10-20", programDayId: "A1", durationMin: 62 });
    expect(logged.sets).toHaveLength(11);
    expect(summary).toMatchObject({ dayName: "A1", setsDone: 11, setsPlanned: 11 });
    expect(summary.events.map((e) => e.key)).toEqual(["T1:back-squat", "T2:bench-press", "T3:lat-pulldown"]);
    expect(next["T1:back-squat"].weight).toBe(state["T1:back-squat"].weight + 10);
  });

  it("treats exercises with nothing logged as skipped", () => {
    let s = start();
    for (let i = 0; i < 5; i++) s = logSet(s, { weight: s.slots[0].sets[0].weight, reps: 3 }, now.getTime());
    const { summary } = finishSession({ session: s, program, state, exercises: exerciseById, athlete, history: sessions, date: "2026-10-20", now });
    expect(summary.events.map((e) => e.kind)).toEqual(["progressed", "skipped", "skipped"]);
    expect(summary.setsDone).toBe(5);
  });
});

describe("personalBests", () => {
  it("reports a new best estimated 1RM against all earlier sessions", () => {
    const pr = { id: "x", date: "2026-10-20", durationMin: 60, sets: [{ exerciseId: "bench-press", setIndex: 0, weight: 215, reps: 4 }] };
    expect(personalBests(pr, sessions)).toEqual([{ exerciseId: "bench-press", e1rm: 215 * (1 + 4 / 30), previous: 205 * (1 + 4 / 30), set: { weight: 215, reps: 4 } }]);
    const notPr = { ...pr, sets: [{ ...pr.sets[0], weight: 185 }] };
    expect(personalBests(notPr, sessions)).toEqual([]);
  });
});

describe("withLogged", async () => {
  const { withLogged } = await import("@/lib/dataset/training");
  const { sampleDataset } = await import("@/lib/dataset/dataset");
  it("appends logged sessions in date order and moves the end date", () => {
    const logged = { id: "l1", date: "2026-10-20", durationMin: 50, sets: [{ exerciseId: "back-squat", setIndex: 0, weight: 335, reps: 3 }] };
    const merged = withLogged(sampleDataset, [logged]);
    expect(merged.sessions.at(-1)).toBe(logged);
    expect(merged.end).toBe("2026-10-20");
    expect(merged.label).toBe("Sample athlete + 1 logged");
    expect(withLogged(sampleDataset, [])).toBe(sampleDataset);
  });
});
