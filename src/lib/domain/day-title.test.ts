import { describe, expect, it } from "vitest";
import { dayLabel, dayTitle } from "./describe";

const program = (...names: string[]) => ({ days: names.map((name, i) => ({ id: `d${i}`, name })) });

describe("dayTitle", () => {
  it("numbers rotation codes as workouts and keeps the code as a tag", () => {
    const p = program("A1", "B1", "A2", "B2");
    expect(dayTitle(p, p.days[3])).toEqual({ title: "Workout 4", code: "B2" });
    expect(dayLabel(p, p.days[0])).toBe("Workout 1 (A1)");
  });

  it("keeps real names and drops codes that only repeat the number", () => {
    const named = program("Upper A", "Monday");
    expect(dayTitle(named, named.days[1])).toEqual({ title: "Monday", code: null });
    const numbered = program("1", "2");
    expect(dayTitle(numbered, numbered.days[1])).toEqual({ title: "Workout 2", code: null });
  });
});
