import type { Program, ProgramDay, Rule, Session, SetScheme } from "./types";

/** "5×3+" for five sets of three with the last set AMRAP. */
export function formatScheme(scheme: SetScheme) {
  return `${scheme.sets}×${scheme.reps}${scheme.amrapLast ? "+" : ""}`;
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
