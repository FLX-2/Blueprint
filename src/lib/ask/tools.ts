import { epley, weekStart } from "@/lib/calc/strength";
import type { Dataset } from "@/lib/dataset/dataset";
import type { IsoDate, MuscleGroup, Session } from "@/lib/domain/types";
import { formatShortDate } from "@/lib/format";
import { ToolInputs, type ToolInput, type ToolName } from "./tool-defs";

/**
 * The analysis tools Claude can call while answering a question. They run
 * in the browser, on the active dataset, and are plain deterministic code:
 * every number the lifter sees comes from here, never from the model.
 */

export type ChartData = { kind: "line" | "bars"; unit: string; label: string; points: Array<{ x: IsoDate; y: number }> };

export type Evidence = {
  title: string;
  columns: [string, string, string];
  rows: Array<{ date: IsoDate; cells: [string, string, string] }>;
  note?: string;
};

export type ToolResult = {
  id: string;
  tool: ToolName;
  /** Step label shown while answering, written by code from the inputs. */
  label: string;
  ok: boolean;
  /** Compact JSON sent back to the model. */
  forModel: Record<string, unknown>;
  chart?: ChartData;
  evidence?: Evidence;
};

const DAY_MS = 86_400_000;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const round1 = (n: number) => Math.round(n * 10) / 10;

const addDays = (date: IsoDate, days: number) =>
  new Date(new Date(`${date}T00:00:00Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);

const weeksBetween = (a: IsoDate, b: IsoDate) =>
  Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / (7 * DAY_MS));

export function formatRange(from: IsoDate, to: IsoDate) {
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return `${formatShortDate(from)}${sameYear ? "" : `, ${from.slice(0, 4)}`} – ${formatShortDate(to)}, ${to.slice(0, 4)}`;
}

class ToolError extends Error {}

function range(data: Dataset, from: string | null, to: string | null): [IsoDate, IsoDate] {
  const start = data.sessions[0]?.date ?? data.end;
  const a = from ?? start;
  const b = to ?? data.end;
  if (!ISO.test(a) || !ISO.test(b)) throw new ToolError("Dates must be YYYY-MM-DD.");
  return a <= b ? [a, b] : [b, a];
}

function inRange(sessions: Session[], [from, to]: [IsoDate, IsoDate]) {
  return sessions.filter((s) => s.date >= from && s.date <= to);
}

function weeksIn([from, to]: [IsoDate, IsoDate]) {
  const weeks: IsoDate[] = [];
  for (let w = weekStart(from); w <= to; w = addDays(w, 7)) weeks.push(w);
  return weeks;
}

function exerciseName(data: Dataset, id: string) {
  const exercise = data.exerciseById.get(id);
  if (!exercise) throw new ToolError(`Unknown exercise id "${id}". Call list_exercises for valid ids.`);
  return exercise.name;
}

/** Best e1RM per week with the set that produced it. Weeks without the lift are skipped. */
function weeklyTopSets(sessions: Session[], exerciseId: string) {
  const weeks = new Map<IsoDate, { e1rm: number; weight: number; reps: number; date: IsoDate }>();
  for (const s of sessions) {
    for (const set of s.sets) {
      if (set.exerciseId !== exerciseId || set.weight <= 0) continue;
      const e = epley(set.weight, set.reps);
      const week = weekStart(s.date);
      const current = weeks.get(week);
      if (!current || e > current.e1rm) weeks.set(week, { e1rm: e, weight: set.weight, reps: set.reps, date: s.date });
    }
  }
  return [...weeks.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([week, v]) => ({ week, ...v }));
}

/** The last week a lift beat its running best by more than 1%. */
function lastNewBest(weeks: Array<{ week: IsoDate; e1rm: number }>) {
  let best = -Infinity;
  let lastWeek: IsoDate | null = null;
  for (const w of weeks) {
    if (w.e1rm > best * 1.01) lastWeek = w.week;
    best = Math.max(best, w.e1rm);
  }
  return { lastWeek, best };
}

function setsPerWeek(data: Dataset, sessions: Session[], weeks: IsoDate[], match: (exerciseId: string) => boolean) {
  const counts = new Map(weeks.map((w) => [w, { sets: 0, days: new Set<IsoDate>() }]));
  for (const s of sessions) {
    const entry = counts.get(weekStart(s.date));
    if (!entry) continue;
    const n = s.sets.filter((set) => match(set.exerciseId)).length;
    entry.sets += n;
    if (n) entry.days.add(s.date);
  }
  return weeks.map((w) => ({ week: w, sets: counts.get(w)!.sets, training_days: counts.get(w)!.days.size }));
}

function subjectMatcher(data: Dataset, muscle: MuscleGroup | null, exerciseId: string | null) {
  if (exerciseId) {
    const name = exerciseName(data, exerciseId);
    return { label: name, match: (id: string) => id === exerciseId };
  }
  if (muscle) return { label: `${muscle} sets`, match: (id: string) => !!data.exerciseById.get(id)?.muscles.includes(muscle) };
  throw new ToolError("Give a muscle or an exercise_id.");
}

type Impl<N extends ToolName> = (data: Dataset, input: ToolInput<N>, id: string) => Omit<ToolResult, "id" | "tool" | "ok">;

const impls: { [N in Exclude<ToolName, "show_answer">]: Impl<N> } = {
  list_exercises(data) {
    const stats = new Map<string, { sessions: number; first: IsoDate; last: IsoDate }>();
    for (const s of data.sessions) {
      for (const id of new Set(s.sets.map((set) => set.exerciseId))) {
        const st = stats.get(id) ?? { sessions: 0, first: s.date, last: s.date };
        st.sessions++;
        st.last = s.date;
        stats.set(id, st);
      }
    }
    const exercises = [...stats.entries()]
      .sort((a, b) => b[1].sessions - a[1].sessions)
      .map(([id, st]) => ({ exercise_id: id, name: data.exerciseById.get(id)?.name ?? id, ...st }));
    return { label: "Listed the exercises in your log", forModel: { exercises } };
  },

  lift_trend(data, input, id) {
    const name = exerciseName(data, input.exercise_id);
    const r = range(data, input.from, input.to);
    const sessions = inRange(data.sessions, r);
    const weeks = weeklyTopSets(sessions, input.exercise_id);
    if (!weeks.length) throw new ToolError(`No weighted sets of ${name} between ${r[0]} and ${r[1]}.`);

    const first = weeks[0];
    const last = weeks.at(-1)!;
    const bestWeek = weeks.reduce((a, b) => (b.e1rm > a.e1rm ? b : a));
    const { lastWeek } = lastNewBest(weeks);
    const topSets: Evidence["rows"] = [];
    for (const s of sessions) {
      let top: { w: number; r: number; e: number } | null = null;
      for (const set of s.sets) {
        if (set.exerciseId !== input.exercise_id || set.weight <= 0) continue;
        const e = epley(set.weight, set.reps);
        if (!top || e > top.e) top = { w: set.weight, r: set.reps, e };
      }
      if (top) topSets.push({ date: s.date, cells: [formatShortDate(s.date), `${top.w} × ${top.r}`, String(Math.round(top.e))] });
    }

    return {
      label: `Estimated 1RM per week · ${name} · ${formatRange(r[0], r[1])}`,
      forModel: {
        result_id: id,
        exercise: name,
        unit: "lb",
        from: r[0],
        to: r[1],
        weeks: weeks.map((w) => ({ week: w.week, best_e1rm: Math.round(w.e1rm), top_set: `${w.weight} × ${w.reps}` })),
        summary: {
          first_week: { week: first.week, best_e1rm: Math.round(first.e1rm) },
          last_week: { week: last.week, best_e1rm: Math.round(last.e1rm) },
          best: { week: bestWeek.week, best_e1rm: Math.round(bestWeek.e1rm), top_set: `${bestWeek.weight} × ${bestWeek.reps}` },
          change_lb: Math.round(last.e1rm - first.e1rm),
          change_pct: round1((last.e1rm / first.e1rm - 1) * 100),
          last_new_best_week: lastWeek,
          weeks_since_new_best: lastWeek ? weeksBetween(lastWeek, weekStart(r[1])) : null,
        },
      },
      chart: { kind: "line", unit: "lb", label: `${name} · est. 1RM`, points: weeks.map((w) => ({ x: w.week, y: Math.round(w.e1rm) })) },
      evidence: {
        title: `${name} · top set per session`,
        columns: ["Date", "Top set", "Est. 1RM"],
        rows: topSets,
        note: "Est. 1RM uses the Epley formula: weight × (1 + reps ÷ 30).",
      },
    };
  },

  weekly_sets(data, input, id) {
    const { label, match } = subjectMatcher(data, input.muscle, input.exercise_id);
    const r = range(data, input.from, input.to);
    const rows = setsPerWeek(data, inRange(data.sessions, r), weeksIn(r), match);
    const average = round1(rows.reduce((n, w) => n + w.sets, 0) / Math.max(rows.length, 1));
    return {
      label: `Weekly ${label} · ${formatRange(r[0], r[1])}`,
      forModel: { result_id: id, subject: label, from: r[0], to: r[1], weeks: rows, average_sets: average },
      chart: { kind: "bars", unit: "sets", label: `Weekly ${label}`, points: rows.map((w) => ({ x: w.week, y: w.sets })) },
      evidence: {
        title: `Weekly ${label}`,
        columns: ["Week of", "Sets", "Days"],
        rows: rows.map((w) => ({ date: w.week, cells: [formatShortDate(w.week), String(w.sets), String(w.training_days)] })),
        note: input.muscle ? `Counts working sets of every exercise tagged ${input.muscle}.` : undefined,
      },
    };
  },

  training_frequency(data, input, id) {
    const r = range(data, input.from, input.to);
    const sessions = inRange(data.sessions, r);
    const weeks = weeksIn(r).map((w) => ({ week: w, sessions: sessions.filter((s) => weekStart(s.date) === w).length }));
    const average = round1(weeks.reduce((n, w) => n + w.sessions, 0) / Math.max(weeks.length, 1));
    return {
      label: `Sessions per week · ${formatRange(r[0], r[1])}`,
      forModel: { result_id: id, from: r[0], to: r[1], weeks, average_sessions: average },
      chart: { kind: "bars", unit: "sessions", label: "Sessions per week", points: weeks.map((w) => ({ x: w.week, y: w.sessions })) },
      evidence: {
        title: "Sessions per week",
        columns: ["Week of", "Sessions", ""],
        rows: weeks.map((w) => ({ date: w.week, cells: [formatShortDate(w.week), String(w.sessions), ""] })),
      },
    };
  },

  compare_periods(data, input, id) {
    const periods = [input.period_a, input.period_b].map((p) => range(data, p.from, p.to));
    let subject: string;
    let unit: string;
    let value: (r: [IsoDate, IsoDate]) => number | null;

    if (input.metric === "best_e1rm") {
      if (!input.exercise_id) throw new ToolError("best_e1rm needs an exercise_id.");
      const exerciseId = input.exercise_id;
      subject = exerciseName(data, exerciseId);
      unit = "lb";
      value = (r) => {
        const weeks = weeklyTopSets(inRange(data.sessions, r), exerciseId);
        return weeks.length ? Math.round(Math.max(...weeks.map((w) => w.e1rm))) : null;
      };
    } else if (input.metric === "weekly_sets") {
      const { label, match } = subjectMatcher(data, input.muscle, input.exercise_id);
      subject = label;
      unit = "sets per week";
      value = (r) => {
        const rows = setsPerWeek(data, inRange(data.sessions, r), weeksIn(r), match);
        return rows.length ? round1(rows.reduce((n, w) => n + w.sets, 0) / rows.length) : null;
      };
    } else {
      subject = "training sessions";
      unit = "sessions per week";
      value = (r) => {
        const weeks = weeksIn(r);
        return weeks.length ? round1(inRange(data.sessions, r).length / weeks.length) : null;
      };
    }

    const [a, b] = periods.map(value);
    const difference = a !== null && b !== null ? round1(b - a) : null;
    const changePct = a && b !== null ? round1((b / a - 1) * 100) : null;
    const labelFor = (r: [IsoDate, IsoDate]) => formatRange(r[0], r[1]);

    return {
      label: `Compared ${subject} · ${labelFor(periods[0])} vs ${labelFor(periods[1])}`,
      forModel: {
        result_id: id,
        metric: input.metric,
        subject,
        unit,
        period_a: { from: periods[0][0], to: periods[0][1], value: a },
        period_b: { from: periods[1][0], to: periods[1][1], value: b },
        difference,
        change_pct: changePct,
      },
      evidence: {
        title: `${subject} · ${unit}`,
        columns: ["Period", unit, ""],
        rows: periods.map((r, i) => ({ date: r[0], cells: [labelFor(r), String([a, b][i] ?? "—"), i ? `${difference ?? ""}` : ""] })),
        note: changePct !== null ? `Change: ${changePct}%.` : undefined,
      },
    };
  },

  find_plateaus(data, input, id) {
    const minWeeks = Math.max(1, Math.round(input.min_weeks ?? 6));
    const endWeek = weekStart(data.end);
    const recentFrom = addDays(data.end, -28);
    const plateaus = [];
    for (const exercise of data.exercises) {
      const weeks = weeklyTopSets(data.sessions, exercise.id);
      if (weeks.length < 8 || weeks.at(-1)!.week < recentFrom) continue; // too little data, or not trained lately
      const { lastWeek, best } = lastNewBest(weeks);
      if (!lastWeek) continue;
      const since = weeksBetween(lastWeek, endWeek);
      if (since >= minWeeks) {
        plateaus.push({ exercise_id: exercise.id, exercise: exercise.name, best_e1rm: Math.round(best), last_new_best_week: lastWeek, weeks_since_new_best: since });
      }
    }
    plateaus.sort((a, b) => b.weeks_since_new_best - a.weeks_since_new_best);
    return {
      label: `Looked for lifts without a new best in ${minWeeks}+ weeks`,
      forModel: { result_id: id, as_of: data.end, min_weeks: minWeeks, plateaus },
      evidence: {
        title: `No new best in ${minWeeks}+ weeks`,
        columns: ["Lift", "Weeks", "Best e1RM"],
        rows: plateaus.map((p) => ({ date: p.last_new_best_week, cells: [p.exercise, String(p.weeks_since_new_best), String(p.best_e1rm)] })),
        note: "A new best means beating the previous best estimated 1RM by more than 1%.",
      },
    };
  },
};

export function isAnalysisTool(name: string): name is Exclude<ToolName, "show_answer"> {
  return name in impls;
}

/** Validates the model's input and runs the tool. Errors come back as results the model can read. */
export function runTool(data: Dataset, name: string, input: unknown, id: string): ToolResult {
  if (!isAnalysisTool(name)) {
    return { id, tool: "list_exercises", label: `Unknown tool ${name}`, ok: false, forModel: { error: `Unknown tool "${name}".` } };
  }
  const parsed = ToolInputs[name].safeParse(input);
  if (!parsed.success) {
    return { id, tool: name, label: `Couldn’t run ${name}`, ok: false, forModel: { error: `Invalid input: ${parsed.error.message}` } };
  }
  try {
    const impl = impls[name] as Impl<typeof name>;
    return { id, tool: name, ok: true, ...impl(data, parsed.data as never, id) };
  } catch (error) {
    if (error instanceof ToolError) return { id, tool: name, label: `Couldn’t run ${name}`, ok: false, forModel: { error: error.message } };
    throw error;
  }
}
