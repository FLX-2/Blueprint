import type { Program, ProgramDay, Rule, Session, SetScheme, Tier } from "./types";

/** "5×3+" for five sets of three with the last set AMRAP. */
export function formatScheme(scheme: SetScheme) {
  return `${scheme.sets}×${scheme.reps}${scheme.amrapLast ? "+" : ""}`;
}

/**
 * Plain names for tiers, shown first; the program's own code (T1…) rides
 * along as a small tag for lifters who know it.
 */
export const TIER_NAMES: Record<Tier, { one: string; many: string; about: string }> = {
  T1: { one: "Main lift", many: "Main lifts", about: "Heavy, low reps. The lift the session is built around." },
  T2: { one: "Secondary", many: "Secondary lifts", about: "Moderate weight, more sets. Builds volume for a main lift." },
  T3: { one: "Accessory", many: "Accessories", about: "Light, high reps. Muscle and joint health." },
};

/**
 * "Workout 1" for a day named with a rotation code ("A1"), keeping the code
 * as a tag. Days with real names ("Monday", "Upper A") keep their name.
 */
type Named = { id: string; name: string };

export function dayTitle(program: { days: Named[] }, day: Named): { title: string; code: string | null } {
  const index = program.days.findIndex((d) => d.id === day.id);
  const name = day.name.trim();
  const isCode = /^[A-Za-z]?\d{0,2}[A-Za-z]?$/.test(name) && name.length <= 3;
  if (!isCode) return { title: name, code: null };
  return { title: `Workout ${index + 1}`, code: name === String(index + 1) ? null : name };
}

/** One-line label, e.g. "Workout 1 (A1)". For places that can't show a tag. */
export function dayLabel(program: { days: Named[] }, day: Named) {
  const { title, code } = dayTitle(program, day);
  return code ? `${title} (${code})` : title;
}

const RULE_TITLES: Record<Rule["kind"], string> = {
  linear: "Progress",
  "stage-on-failure": "On failure",
  "amrap-threshold": "Progress",
  "double-progression": "Progress",
  "percentage-cycle": "Cycle",
};

export function ruleTitle(rule: Rule) {
  return RULE_TITLES[rule.kind];
}

/** A rule in the plain language shown on Review and Plan screens. */
export function describeRule(rule: Rule) {
  switch (rule.kind) {
    case "linear":
      return `+${rule.increment.lower} lb lower · +${rule.increment.upper} lb upper, after a full session`;
    case "stage-on-failure": {
      const stages = rule.stages.map(formatScheme).join(" → ");
      const percent = Math.round(rule.reset.percent * 100);
      const reset =
        rule.reset.percentOf === "retest-5rm"
          ? `retest 5RM, restart at ${percent}%`
          : `reset: ${formatScheme(rule.reset.to)} at ${percent}% of last weight`;
      return `${stages} → ${reset}`;
    }
    case "amrap-threshold":
      return `Add weight when the last set hits ${rule.repTarget}+ reps`;
    case "double-progression":
      return `Add a rep each session from ${rule.repRange.min} to ${rule.repRange.max}, then +${rule.increment.lower} lb lower · +${rule.increment.upper} lb upper and back to ${rule.repRange.min}`;
    case "percentage-cycle": {
      const weeks = rule.weeks
        .map((w) => w.sets.map((s) => `${Math.round(s.percent * 100)}%×${s.reps}${s.amrap ? "+" : ""}`).join(" "))
        .join(" / ");
      return `${rule.weeks.length}-week cycle of training-max percentages (${weeks}); then +${rule.increment.lower} lb lower · +${rule.increment.upper} lb upper`;
    }
  }
}

/** Days rotate in order regardless of the calendar: the day after the last one logged. */
export function nextDay(program: Program, sessions: Session[]): ProgramDay {
  const last = [...sessions].reverse().find((s) => s.programDayId);
  const index = program.days.findIndex((d) => d.id === last?.programDayId);
  return program.days[(index + 1) % program.days.length];
}

/**
 * The most recent sets of this exercise. With `dayId`, prefers the same
 * program day, so a T1 slot shows the last heavy session, not a T2 day.
 */
export function lastTimeFor(sessions: Session[], exerciseId: string, dayId?: string) {
  const find = (sameDay: boolean) => {
    for (let i = sessions.length - 1; i >= 0; i--) {
      if (sameDay && sessions[i].programDayId !== dayId) continue;
      const sets = sessions[i].sets.filter((s) => s.exerciseId === exerciseId);
      if (sets.length) return { date: sessions[i].date, sets };
    }
    return null;
  };
  return (dayId ? find(true) : null) ?? find(false);
}
