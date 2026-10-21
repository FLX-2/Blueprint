import { describe, expect, it } from "vitest";
import { routeIntent } from "./route-intent";

describe("routeIntent", () => {
  it.each([
    "Traveling for my next three sessions, hotel gym only",
    "I only have 30 minutes tomorrow",
    "no barbell this week",
    "My lower back hurts a bit",
    "skip squats next session",
    "Feeling run down, go easy",
    "Should I skip deadlifts? My back hurts",
  ])("sends “%s” to Bend the week", (text) => {
    expect(routeIntent(text).kind).toBe("adapt");
  });

  it.each([
    "Why has my bench stalled?",
    "How is my squat trending?",
    "What did I do after the trip in March?",
    "Compare my sets per week this year",
    "best deadlift",
  ])("sends “%s” to Ask", (text) => {
    expect(routeIntent(text).kind).toBe("ask");
  });

  it("keeps the text in the link", () => {
    expect(routeIntent("no barbell this week").href).toBe("/plan/adapt?c=no%20barbell%20this%20week");
    expect(routeIntent("").href).toBe("/review/ask");
  });
});
