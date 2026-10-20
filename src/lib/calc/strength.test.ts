import { describe, expect, it } from "vitest";
import { epley, roundToLoadable, weekStart } from "./strength";

describe("epley", () => {
  it("matches the formula shown to users", () => {
    expect(epley(205, 4)).toBeCloseTo(232.33, 2);
    expect(epley(205, 3)).toBeCloseTo(225.5, 2);
  });

  it("treats a single as its own max and zero reps as nothing", () => {
    expect(epley(300, 1)).toBe(300);
    expect(epley(300, 0)).toBe(0);
  });
});

describe("weekStart", () => {
  it("returns the Monday of the week", () => {
    expect(weekStart("2026-08-10")).toBe("2026-08-10"); // Monday
    expect(weekStart("2026-08-16")).toBe("2026-08-10"); // Sunday
    expect(weekStart("2026-08-17")).toBe("2026-08-17");
  });
});

describe("roundToLoadable", () => {
  it("rounds down to the smallest plate jump", () => {
    expect(roundToLoadable(203.4, 5)).toBe(200);
    expect(roundToLoadable(205, 5)).toBe(205);
  });
});
