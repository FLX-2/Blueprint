import type { ShowAnswerInput } from "./tool-defs";
import type { ToolResult } from "./tools";

/**
 * Checks an answer before it's shown: every number in the text must appear
 * in a tool result (allowing for rounding), and every chart or evidence
 * reference must point at a real result. The model gets one chance to fix
 * problems; anything left is flagged in the UI instead of shown as fact.
 */

const MONTH = "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?";
const DATE_PATTERNS = [
  /\b\d{4}-\d{2}-\d{2}\b/g,
  new RegExp(`\\b${MONTH}\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s+\\d{4})?\\b`, "gi"),
  new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+${MONTH}(?:\\s+\\d{4})?\\b`, "gi"),
  /\b(?:19|20)\d{2}\b/g,
];

/** Numbers a reader would take as data, ignoring dates, years and "1RM". */
export function numbersIn(text: string): string[] {
  let t = text;
  for (const p of DATE_PATTERNS) t = t.replace(p, " ");
  t = t.replace(/\be?1\s?rm\b/gi, " ");
  const out: string[] = [];
  for (const match of t.matchAll(/\d+(?:[.,]\d+)?/g)) {
    const raw = match[0];
    const value = /^\d{1,3},\d{3}$/.test(raw) ? Number(raw.replace(",", "")) : Number(raw.replace(",", "."));
    if (Number.isFinite(value)) out.push(String(value));
  }
  return out;
}

function addVariants(set: Set<string>, n: number) {
  for (const v of [n, Math.abs(n)]) {
    set.add(String(v));
    set.add(String(Math.round(v)));
    set.add(String(Math.round(v * 10) / 10));
  }
}

/** Every number present in the results, with the rounded forms a writer might use. */
export function allowedNumbers(results: ToolResult[]) {
  const set = new Set<string>();
  const walk = (value: unknown) => {
    if (typeof value === "number") addVariants(set, value);
    else if (typeof value === "string") for (const n of numbersIn(value)) addVariants(set, Number(n));
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object") Object.values(value).forEach(walk);
  };
  for (const r of results) if (r.ok) walk(r.forModel);
  return set;
}

export type AnswerCheck = {
  /** Segment index → numbers that no tool result supports. */
  unverified: Record<number, string[]>;
  problems: string[];
};

export function checkAnswer(answer: ShowAnswerInput, results: Record<string, ToolResult>): AnswerCheck {
  const allowed = allowedNumbers(Object.values(results));
  const unverified: Record<number, string[]> = {};
  const problems: string[] = [];

  answer.answer.forEach((segment, i) => {
    const missing = numbersIn(segment.text).filter((n) => !allowed.has(n));
    if (missing.length) {
      unverified[i] = missing;
      problems.push(`Segment ${i + 1} has numbers that aren't in any tool result: ${missing.join(", ")}.`);
    }
    if (segment.evidence && !results[segment.evidence.result_id]?.evidence) {
      problems.push(`Segment ${i + 1} cites "${segment.evidence.result_id}", which has no evidence rows.`);
    }
  });
  answer.charts.forEach((chart, i) => {
    if (!results[chart.result_id]?.chart) problems.push(`Chart ${i + 1} uses "${chart.result_id}", which has no chart data.`);
  });
  if (answer.charts.length > 2) problems.push("Show at most 2 charts.");

  return { unverified, problems };
}
