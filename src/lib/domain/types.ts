/**
 * Core domain model (see docs/02-structure-and-flows.md § Key objects).
 * Weights are stored in pounds; display converts to the athlete's unit.
 * Dates are ISO calendar dates ("2026-08-10") in the athlete's local time.
 */

export type IsoDate = string;
export type Unit = "lb" | "kg";

export type MuscleGroup = "chest" | "back" | "legs" | "shoulders" | "arms";
export type MovementPattern =
  | "squat"
  | "hinge"
  | "horizontal-push"
  | "vertical-push"
  | "horizontal-pull"
  | "vertical-pull"
  | "accessory";
export type Equipment = "barbell" | "dumbbell" | "cable" | "machine" | "bodyweight";

export type Exercise = {
  id: string;
  name: string;
  /** Other names the athlete or other apps use. Powers CSV name cleanup. */
  aliases: string[];
  pattern: MovementPattern;
  /** Muscle groups counted when totaling weekly sets. */
  muscles: MuscleGroup[];
  equipment: Equipment;
  /** Lower-body lifts progress in bigger jumps in most programs. */
  body: "upper" | "lower";
};

export type Tier = "T1" | "T2" | "T3";

export type SetScheme = {
  sets: number;
  reps: number;
  /** Last set is as-many-reps-as-possible. */
  amrapLast: boolean;
};

export type ExerciseSlot = {
  exerciseId: string;
  tier: Tier;
  scheme: SetScheme;
};

export type ProgramDay = {
  id: string;
  name: string;
  slots: ExerciseSlot[];
};

/** Where an extracted item came from in the source text: [start, end) offsets. */
export type SourceSpan = { start: number; end: number };

export type RuleStatus = "proposed" | "confirmed";

/** lb added on progression, by lower- or upper-body lift. */
export type Increment = { upper: number; lower: number };

/** One week of a percentage cycle (e.g. 5/3/1): sets as fractions of the training max. */
export type CycleWeek = { sets: Array<{ percent: number; reps: number; amrap: boolean }> };

type RuleBase = {
  id: string;
  /** Which slots the rule applies to. */
  tier: Tier;
  /** Only confirmed rules run. */
  status: RuleStatus;
  /** How sure the import was about this rule, 0–1. */
  confidence: number;
  source?: SourceSpan;
};

/**
 * The progression patterns the rule engine knows how to run (src/lib/engine).
 * A tier has one progression rule and, optionally, a stage-on-failure rule
 * that decides what happens when a session is missed.
 */
export type Rule = RuleBase &
  (
    | {
        /** Add weight after every session where all reps were hit. */
        kind: "linear";
        increment: Increment;
      }
    | {
        /** On a miss, step to the next scheme at the same weight; after the last, reset lighter. */
        kind: "stage-on-failure";
        stages: SetScheme[];
        reset: { to: SetScheme; percentOf: "last-weight" | "retest-5rm"; percent: number };
      }
    | {
        /** Add weight once the last (AMRAP) set reaches this many reps. */
        kind: "amrap-threshold";
        repTarget: number;
        increment: Increment;
      }
    | {
        /** Add a rep each success until the top of the range, then add weight and drop to the bottom. */
        kind: "double-progression";
        repRange: { min: number; max: number };
        increment: Increment;
      }
    | {
        /** Fixed weekly percentages of a training max; the max goes up after each full cycle. */
        kind: "percentage-cycle";
        weeks: CycleWeek[];
        increment: Increment;
      }
  );

export type RuleKind = Rule["kind"];

export type Program = {
  id: string;
  name: string;
  /** Days rotate in order regardless of the calendar. */
  days: ProgramDay[];
  rules: Rule[];
  source?: { kind: "text" | "link" | "file"; label: string };
};

export type SetLog = {
  exerciseId: string;
  setIndex: number;
  weight: number;
  reps: number;
  /** Planned reps, when the set came from a program. */
  targetReps?: number;
  rpe?: number;
};

export type Session = {
  id: string;
  date: IsoDate;
  programDayId?: string;
  durationMin: number;
  sets: SetLog[];
  notes?: string;
};

export type GymProfile = {
  id: string;
  name: string;
  equipment: Equipment[];
  /** Heaviest dumbbell available, in lb. */
  maxDumbbell?: number;
};

export type Athlete = {
  name: string;
  initials: string;
  unit: Unit;
  barWeight: number;
  /** Smallest jump the athlete can load, used for rounding targets. */
  smallestPlatePair: number;
};
