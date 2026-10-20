import { describe, expect, it } from "vitest";
import { sampleDataset } from "@/lib/dataset/dataset";
import { runTool } from "./tools";

const run = (name: string, input: unknown) => runTool(sampleDataset, name, input, "r1");

describe("analysis tools on the sample athlete", () => {
  it("lists exercises with ids and session counts", () => {
    const r = run("list_exercises", {});
    const list = r.forModel.exercises as Array<{ exercise_id: string; sessions: number }>;
    expect(list.map((e) => e.exercise_id)).toContain("bench-press");
    expect(list[0].sessions).toBeGreaterThan(100);
  });

  it("finds the bench plateau, and not squat", () => {
    const r = run("find_plateaus", { min_weeks: 6 });
    const plateaus = r.forModel.plateaus as Array<{ exercise_id: string; weeks_since_new_best: number; best_e1rm: number }>;
    const bench = plateaus.find((p) => p.exercise_id === "bench-press");
    expect(bench).toBeDefined();
    expect(bench!.weeks_since_new_best).toBeGreaterThanOrEqual(9);
    expect(bench!.best_e1rm).toBe(232);
    expect(plateaus.some((p) => p.exercise_id === "back-squat")).toBe(false);
  });

  it("summarizes the bench trend from June", () => {
    const r = run("lift_trend", { exercise_id: "bench-press", from: "2026-06-01", to: null });
    const summary = r.forModel.summary as Record<string, unknown>;
    expect(summary.best).toMatchObject({ best_e1rm: 232, top_set: "205 × 4" });
    expect(summary.last_new_best_week).toBe("2026-08-03");
    expect(r.chart?.kind).toBe("line");
    expect(r.evidence?.rows.length).toBeGreaterThan(30);
  });

  it("compares weekly chest sets before and after the switch to three days", () => {
    const r = run("compare_periods", {
      metric: "weekly_sets",
      exercise_id: null,
      muscle: "chest",
      period_a: { from: "2026-06-01", to: "2026-08-09" },
      period_b: { from: "2026-08-10", to: "2026-10-16" },
    });
    const a = (r.forModel.period_a as { value: number }).value;
    const b = (r.forModel.period_b as { value: number }).value;
    expect(Math.round(a)).toBe(14);
    expect(Math.round(b)).toBe(8);
    expect(r.forModel.change_pct).toBeLessThan(-30);
  });

  it("counts training days per week", () => {
    const r = run("training_frequency", { from: "2026-08-10", to: "2026-10-11" });
    expect(r.forModel.average_sessions).toBe(3);
  });

  it("returns readable errors instead of throwing", () => {
    expect(run("lift_trend", { exercise_id: "nope", from: null, to: null }).forModel.error).toMatch(/Unknown exercise id/);
    expect(run("weekly_sets", { muscle: null, exercise_id: null, from: null, to: null }).ok).toBe(false);
    expect(run("lift_trend", { exercise_id: "bench-press" }).forModel.error).toMatch(/Invalid input/);
    expect(run("delete_everything", {}).ok).toBe(false);
  });
});
