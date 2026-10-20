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

/** The progression patterns the rule engine knows how to run. */
export type Rule =
  | {
      id: string;
      kind: "linear";
      tier: Tier;
      /** lb added after a successful session. */
      increment: { upper: number; lower: number };
      status: RuleStatus;
      confidence: number;
      source?: SourceSpan;
    }
  | {
      id: string;
      kind: "stage-on-failure";
      tier: Tier;
      /** Schemes to step through on each failure, in order. */
      stages: SetScheme[];
      /** After the last stage fails: restart at this fraction of the reference weight. */
      reset: { to: SetScheme; percentOf: "last-weight" | "retest-5rm"; percent: number };
      status: RuleStatus;
      confidence: number;
      source?: SourceSpan;
    }
  | {
      id: string;
      kind: "amrap-threshold";
      tier: Tier;
      /** Add weight once the AMRAP set reaches this many reps. */
      repTarget: number;
      increment: { upper: number; lower: number };
      status: RuleStatus;
      confidence: number;
      source?: SourceSpan;
    };

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
