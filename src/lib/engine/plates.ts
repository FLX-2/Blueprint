/** Standard plates in lb, heaviest first. */
export const DEFAULT_PLATES = [45, 35, 25, 10, 5, 2.5];

export type PlateLoad = {
  /** Plates for one side of the bar, heaviest first. */
  perSide: number[];
  /** What the bar actually weighs loaded like that (≤ the target). */
  total: number;
  /** True when the target can't be loaded exactly with these plates. */
  rounded: boolean;
};

/**
 * Plates per side for a target weight. Greedy works for standard plate sets
 * (each plate is at least twice the next smaller pair's difference), and
 * never loads more than the target.
 */
export function platesFor(target: number, bar = 45, plates: number[] = DEFAULT_PLATES): PlateLoad {
  if (target <= bar) return { perSide: [], total: bar, rounded: target !== bar };
  let remaining = (target - bar) / 2;
  const perSide: number[] = [];
  for (const plate of [...plates].sort((a, b) => b - a)) {
    while (remaining + 1e-9 >= plate) {
      perSide.push(plate);
      remaining -= plate;
    }
  }
  const total = bar + 2 * perSide.reduce((a, b) => a + b, 0);
  return { perSide, total, rounded: Math.abs(total - target) > 1e-9 };
}
