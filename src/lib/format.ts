import type { IsoDate, SetLog } from "./domain/types";

const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const longDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** "Aug 10". Formatted in UTC so server and client always agree. */
export function formatShortDate(date: IsoDate) {
  return shortDate.format(new Date(`${date}T00:00:00Z`));
}

/** "Aug 10, 2026". */
export function formatLongDate(date: IsoDate) {
  return longDate.format(new Date(`${date}T00:00:00Z`));
}

export function formatLb(value: number) {
  return `${Math.round(value)} lb`;
}

/** "205 × 3, 3, 3, 3, 4" when every set used the same weight. */
export function formatSets(sets: SetLog[]) {
  if (!sets.length) return "";
  const sameWeight = sets.every((s) => s.weight === sets[0].weight);
  if (sameWeight) {
    const load = sets[0].weight === 0 ? "BW" : `${sets[0].weight}`;
    return `${load} × ${sets.map((s) => s.reps).join(", ")}`;
  }
  return sets.map((s) => `${s.weight}×${s.reps}`).join(", ");
}

/** "+4.2%" / "−1.0%" with a real minus sign. */
export function formatChange(ratio: number) {
  const percent = (ratio * 100).toFixed(1);
  return ratio >= 0 ? `+${percent}%` : `−${percent.slice(1)}%`;
}
