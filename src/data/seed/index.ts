import type { Athlete } from "@/lib/domain/types";
import { generateHistory } from "./history";

export { exercises, exerciseById, getExercise } from "./exercises";
export { gzclp as program, gyms } from "./program";
export { BENCH_BLOCK_START, HISTORY_END, HISTORY_START, THREE_DAY_START } from "./history";

/** Fictional sample athlete for demo mode. */
export const athlete: Athlete = {
  name: "Alex Moreno",
  initials: "AM",
  unit: "lb",
  barWeight: 45,
  smallestPlatePair: 5,
};

/** Every session, oldest first. Generated once per server process. */
export const sessions = generateHistory();
