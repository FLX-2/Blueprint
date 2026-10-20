import { describe, expect, it } from "vitest";
import { bestBetween, liftTrend, weekStart, weeklySets } from "@/lib/calc/strength";
import { toStrongCsv } from "./csv";
import { generateHistory, HISTORY_END, HISTORY_START, THREE_DAY_START } from "./history";
import { exerciseById, program, sessions } from "./index";

const average = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe("seed history", () => {
  it("is deterministic", () => {
    expect(generateHistory()).toEqual(sessions);
  });

  it("stays inside its date range, sorted, with known exercises", () => {
    expect(sessions[0].date >= HISTORY_START).toBe(true);
    expect(sessions.at(-1)!.date <= HISTORY_END).toBe(true);
    for (let i = 1; i < sessions.length; i++) expect(sessions[i].date > sessions[i - 1].date).toBe(true);
    for (const s of sessions) for (const set of s.sets) expect(exerciseById.has(set.exerciseId)).toBe(true);
  });

  it("covers about 18 months", () => {
    expect(sessions.length).toBeGreaterThan(250);
  });
});

describe("the bench stall story", () => {
  const chest = weeklySets(sessions, exerciseById, "chest");
  const weeks = [...chest.entries()];
  const before = weeks.filter(([w]) => w >= "2026-06-01" && w < THREE_DAY_START).map(([, n]) => n);
  const after = weeks.filter(([w]) => w >= THREE_DAY_START).map(([, n]) => n);

  it("drops weekly chest sets from about 14 to about 8", () => {
    expect(average(before)).toBeGreaterThan(13);
    expect(average(before)).toBeLessThan(15);
    expect(average(after)).toBeGreaterThan(7.5);
    expect(average(after)).toBeLessThan(9);
  });

  it("switches from four training days to three", () => {
    const daysPerWeek = (from: string, to: string) => {
      const counts = new Map<string, number>();
      for (const s of sessions) {
        if (s.date < from || s.date >= to) continue;
        const w = weekStart(s.date);
        counts.set(w, (counts.get(w) ?? 0) + 1);
      }
      return new Set(counts.values());
    };
    expect(daysPerWeek("2026-06-01", THREE_DAY_START)).toEqual(new Set([4]));
    expect(daysPerWeek(THREE_DAY_START, "2026-10-12")).toEqual(new Set([3]));
  });

  it("climbs bench from June to August, then holds it flat", () => {
    const bench = liftTrend(sessions, "bench-press");
    const june = bestBetween(bench, "2026-06-01", "2026-06-14")!;
    const peakBefore = bestBetween(bench, "2026-07-27", "2026-08-09")!;
    expect(peakBefore - june).toBeGreaterThan(25);

    const after = bench.filter((p) => p.date >= THREE_DAY_START && p.set.reps < 10);
    const e1rms = after.map((p) => p.e1rm);
    expect(Math.max(...e1rms) - Math.min(...e1rms)).toBeLessThan(8);
    expect(after.every((p) => p.set.weight === 205 && p.set.reps >= 3 && p.set.reps <= 4)).toBe(true);
  });

  it("keeps squat progressing over the same weeks, so the stall is bench-specific", () => {
    const squat = liftTrend(sessions, "back-squat");
    const start = bestBetween(squat, THREE_DAY_START, "2026-08-23")!;
    const end = bestBetween(squat, "2026-09-28", HISTORY_END)!;
    expect(end).toBeGreaterThan(start);
  });
});

describe("seed program", () => {
  it("has every rule confirmed and every slot pointing at a known exercise", () => {
    expect(program.rules.every((r) => r.status === "confirmed")).toBe(true);
    for (const day of program.days) for (const slot of day.slots) expect(exerciseById.has(slot.exerciseId)).toBe(true);
  });
});

describe("CSV export", () => {
  it("writes a header plus one row per set, with alias drift before 2026", () => {
    const csv = toStrongCsv(sessions);
    const lines = csv.trim().split("\n");
    expect(lines[0]).toMatch(/^Date,Workout Name,Duration,Exercise Name/);
    expect(lines.length - 1).toBe(sessions.reduce((n, s) => n + s.sets.length, 0));
    expect(csv).toContain('"Bench Press (Barbell)"');
    expect(csv).toContain('"Bench Press"');
  });
});
