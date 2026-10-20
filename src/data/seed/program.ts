import type { GymProfile, Program, SetScheme } from "@/lib/domain/types";

const s = (sets: number, reps: number, amrapLast = false): SetScheme => ({ sets, reps, amrapLast });

/** The sample athlete's active program: GZCLP, 4-day, all rules confirmed. */
export const gzclp: Program = {
  id: "gzclp-4day",
  name: "GZCLP, 4-day",
  source: { kind: "text", label: "Pasted text" },
  days: [
    {
      id: "A1",
      name: "A1",
      slots: [
        { exerciseId: "back-squat", tier: "T1", scheme: s(5, 3, true) },
        { exerciseId: "bench-press", tier: "T2", scheme: s(3, 10) },
        { exerciseId: "lat-pulldown", tier: "T3", scheme: s(3, 15, true) },
      ],
    },
    {
      id: "B1",
      name: "B1",
      slots: [
        { exerciseId: "overhead-press", tier: "T1", scheme: s(5, 3, true) },
        { exerciseId: "deadlift", tier: "T2", scheme: s(3, 10) },
        { exerciseId: "dumbbell-row", tier: "T3", scheme: s(3, 15, true) },
      ],
    },
    {
      id: "A2",
      name: "A2",
      slots: [
        { exerciseId: "bench-press", tier: "T1", scheme: s(5, 3, true) },
        { exerciseId: "back-squat", tier: "T2", scheme: s(3, 10) },
        { exerciseId: "lat-pulldown", tier: "T3", scheme: s(3, 15, true) },
      ],
    },
    {
      id: "B2",
      name: "B2",
      slots: [
        { exerciseId: "deadlift", tier: "T1", scheme: s(5, 3, true) },
        { exerciseId: "overhead-press", tier: "T2", scheme: s(3, 10) },
        { exerciseId: "dumbbell-row", tier: "T3", scheme: s(3, 15, true) },
      ],
    },
  ],
  rules: [
    { id: "t1-progress", kind: "linear", tier: "T1", increment: { upper: 5, lower: 10 }, status: "confirmed", confidence: 0.96 },
    {
      id: "t1-failure",
      kind: "stage-on-failure",
      tier: "T1",
      stages: [s(5, 3, true), s(6, 2, true), s(10, 1, true)],
      reset: { to: s(5, 3, true), percentOf: "retest-5rm", percent: 0.85 },
      status: "confirmed",
      confidence: 0.72,
    },
    { id: "t2-progress", kind: "linear", tier: "T2", increment: { upper: 5, lower: 10 }, status: "confirmed", confidence: 0.95 },
    {
      id: "t2-failure",
      kind: "stage-on-failure",
      tier: "T2",
      stages: [s(3, 10), s(3, 8), s(3, 6)],
      reset: { to: s(3, 10), percentOf: "last-weight", percent: 0.85 },
      status: "confirmed",
      confidence: 0.48,
    },
    { id: "t3-progress", kind: "amrap-threshold", tier: "T3", repTarget: 25, increment: { upper: 5, lower: 5 }, status: "confirmed", confidence: 0.91 },
  ],
};

export const gyms: GymProfile[] = [
  { id: "home-gym", name: "Ironworks (usual gym)", equipment: ["barbell", "dumbbell", "cable", "machine", "bodyweight"], maxDumbbell: 120 },
  { id: "hotel", name: "Hotel gym", equipment: ["dumbbell", "machine", "bodyweight"], maxDumbbell: 50 },
];
