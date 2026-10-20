import { describe, expect, it } from "vitest";
import { exerciseById, exercises, sessions } from "@/data/seed";
import { toStrongCsv } from "@/data/seed/csv";
import { parseCsv } from "./csv";
import { detectFormat, guessMapping, isComplete } from "./formats";
import { matchName, matchNames, mergeAi, nameKey, needsAi, type Suggestion } from "./match";
import { buildSessions, parseDateLoose, readRows, summarize } from "./rows";

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, CRLF and blank lines", () => {
    const rows = parseCsv('a,b,c\r\n"x, y","say ""hi""",3\r\n\r\nlast,,\n');
    expect(rows).toEqual([
      ["a", "b", "c"],
      ["x, y", 'say "hi"', "3"],
      ["last", "", ""],
    ]);
  });

  it("detects semicolon-delimited files", () => {
    expect(parseCsv("Date;Exercise Name;Set Order\n2026-01-01;Squat;1\n")[1]).toEqual(["2026-01-01", "Squat", "1"]);
  });
});

describe("parseDateLoose", () => {
  it.each([
    ["2026-08-10 07:00:00", "2026-08-10"],
    ["15 Oct 2024, 07:30", "2024-10-15"],
    ["Oct 15, 2024", "2024-10-15"],
    ["8/10/2026", "2026-08-10"],
    ["25/12/2025", "2025-12-25"],
    ["yesterday", null],
  ])("%s → %s", (raw, expected) => {
    expect(parseDateLoose(raw)).toBe(expected);
  });
});

describe("detectFormat", () => {
  it("recognizes Strong", () => {
    const header = parseCsv(toStrongCsv(sessions.slice(0, 1)))[0];
    const detected = detectFormat(header);
    expect(detected.format).toBe("strong");
    expect(isComplete(detected.map)).toBe(true);
    expect(detected.unit).toBeNull();
  });

  it("recognizes Hevy and reads the unit from the weight column", () => {
    const header = "title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe".split(",");
    const detected = detectFormat(header);
    expect(detected.format).toBe("hevy");
    expect(detected.unit).toBe("kg");
    expect(isComplete(detected.map)).toBe(true);
  });

  it("guesses columns for an unknown export", () => {
    const { map, unit } = guessMapping(["Workout", "Day", "Lift", "Load (kg)", "Reps", "Set #"]);
    expect(map).toMatchObject({ workout: 0, date: 1, exercise: 2, weight: 3, reps: 4, setOrder: 5 });
    expect(unit).toBe("kg");
  });
});

describe("readRows", () => {
  it("skips warm-ups, cardio and unreadable dates, and converts kg", () => {
    const rows = [
      ["15 Oct 2024, 07:30", "Push", "Bench Press (Barbell)", "0", "warmup", "40", "8"],
      ["15 Oct 2024, 07:30", "Push", "Bench Press (Barbell)", "1", "normal", "100", "5"],
      ["15 Oct 2024, 07:30", "Push", "Treadmill", "2", "normal", "", ""],
      ["someday", "Push", "Dips", "3", "normal", "", "10"],
    ];
    const { sets, skipped } = readRows(rows, { date: 0, workout: 1, exercise: 2, setOrder: 3, setType: 4, weight: 5, reps: 6 }, "kg");
    expect(sets).toEqual([
      { date: "2024-10-15", workoutKey: "15 Oct 2024, 07:30|Push", exerciseName: "Bench Press (Barbell)", weight: 220.5, reps: 5 },
    ]);
    expect(skipped).toEqual({ warmup: 1, "no-reps": 1, "bad-date": 1, "no-exercise": 0 });
  });
});

describe("matchName", () => {
  const expectMatch = (name: string, id: string | null, method: Suggestion["method"]) => {
    const s = matchName(name, exercises);
    expect({ name, id: s.exerciseId, method: s.method }).toEqual({ name, id, method });
    return s;
  };

  it("matches equivalent spellings exactly", () => {
    expectMatch("Bench Press (Barbell)", "bench-press", "exact");
    expectMatch("bench press - barbell", "bench-press", "exact");
    expectMatch("Deadlifts", "deadlift", "exact");
    expectMatch("Dips (Chest)", "dips", "exact");
    expectMatch("OHP", "overhead-press", "exact");
    expectMatch("Pullups", "pull-up", "exact");
  });

  it("suggests close spellings below the auto-confirm threshold", () => {
    for (const [name, id] of [
      ["Squat - Back (Barbell)", "back-squat"],
      ["Flat Bench (BB)", "bench-press"],
      ["Incline DB Bench", "incline-db-press"],
      ["One Arm DB Row", "dumbbell-row"],
      ["Pull Down (Cable)", "lat-pulldown"],
    ] as const) {
      const s = expectMatch(name, id, "similar");
      expect(s.confidence).toBeLessThan(0.9);
    }
  });

  it("leaves names that need knowledge for the AI", () => {
    expectMatch("Military Press", null, "none");
    expectMatch("Zercher Carry", null, "none");
  });

  it("gives order-independent keys", () => {
    expect(nameKey("Squat (Barbell)")).toBe(nameKey("barbell squat"));
  });
});

describe("mergeAi", () => {
  it("lets the AI fill gaps but never overrides an exact match or invents ids", () => {
    const code = matchNames(["OHP", "Military Press", "Zercher Carry"], exercises);
    expect(needsAi(code)).toEqual(["Military Press", "Zercher Carry"]);
    const merged = mergeAi(
      code,
      [
        { name: "OHP", exerciseId: "deadlift", confidence: 1, method: "ai" },
        { name: "Military Press", exerciseId: "overhead-press", confidence: 0.95, method: "ai", reason: "Military press is a standing barbell overhead press." },
        { name: "Zercher Carry", exerciseId: "made-up", confidence: 0.9, method: "ai" },
      ],
      exerciseById,
    );
    expect(merged.map((s) => [s.name, s.exerciseId, s.method])).toEqual([
      ["OHP", "overhead-press", "exact"],
      ["Military Press", "overhead-press", "ai"],
      ["Zercher Carry", null, "none"],
    ]);
  });
});

describe("importing the demo CSV end to end", () => {
  const rows = parseCsv(toStrongCsv(sessions));
  const detected = detectFormat(rows[0]);
  if (!isComplete(detected.map)) throw new Error("incomplete map");
  const { sets, skipped } = readRows(rows.slice(1), detected.map, "lb");
  const summary = summarize(sets);

  it("reads every set and session", () => {
    expect(summary.sessions).toBe(sessions.length);
    expect(summary.sets).toBe(sessions.reduce((n, s) => n + s.sets.length, 0));
    expect(Object.values(skipped).every((n) => n === 0)).toBe(true);
  });

  it("rebuilds the original history once names are resolved", () => {
    const resolved = new Map<string, string>();
    for (const { name } of summary.names) {
      const s = matchName(name, exercises);
      // Stand in for the user confirming suggestions (and fixing Military Press).
      resolved.set(name, s.exerciseId ?? (name === "Military Press" ? "overhead-press" : "unknown"));
    }
    const rebuilt = buildSessions(sets, (name) => resolved.get(name)!);
    expect(rebuilt.map((s) => s.date)).toEqual(sessions.map((s) => s.date));
    expect(rebuilt.map((s) => s.sets.map(({ exerciseId, weight, reps }) => [exerciseId, weight, reps]))).toEqual(
      sessions.map((s) => s.sets.map(({ exerciseId, weight, reps }) => [exerciseId, weight, reps])),
    );
  });
});
