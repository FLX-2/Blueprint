import { describe, expect, it } from "vitest";
import { platesFor } from "./plates";

describe("platesFor", () => {
  it.each([
    [135, [45]],
    [225, [45, 45]],
    [210, [45, 35, 2.5]],
    [235, [45, 45, 5]],
    [340, [45, 45, 45, 10, 2.5]],
  ])("%d lb → %j per side", (target, perSide) => {
    expect(platesFor(target)).toEqual({ perSide, total: target, rounded: false });
  });

  it("loads just the bar at or below its weight", () => {
    expect(platesFor(45)).toEqual({ perSide: [], total: 45, rounded: false });
    expect(platesFor(40).rounded).toBe(true);
  });

  it("rounds down when the target can't be loaded exactly", () => {
    expect(platesFor(137)).toEqual({ perSide: [45], total: 135, rounded: true });
  });

  it("supports other bars and plate sets", () => {
    expect(platesFor(100, 35, [25, 10, 5])).toEqual({ perSide: [25, 5], total: 95, rounded: true });
  });
});
