import type { Exercise } from "@/lib/domain/types";

export const exercises: Exercise[] = [
  {
    id: "back-squat",
    name: "Back Squat",
    aliases: ["Squat (Barbell)", "BB Squat", "squat"],
    pattern: "squat",
    muscles: ["legs"],
    equipment: "barbell",
    body: "lower",
  },
  {
    id: "bench-press",
    name: "Bench Press",
    aliases: ["Bench Press (Barbell)", "BB Bench", "bench"],
    pattern: "horizontal-push",
    muscles: ["chest", "arms"],
    equipment: "barbell",
    body: "upper",
  },
  {
    id: "deadlift",
    name: "Deadlift",
    aliases: ["Deadlift (Barbell)", "Conventional Deadlift", "DL"],
    pattern: "hinge",
    muscles: ["legs", "back"],
    equipment: "barbell",
    body: "lower",
  },
  {
    id: "overhead-press",
    name: "Overhead Press",
    aliases: ["Overhead Press (Barbell)", "OHP", "Strict Press"],
    pattern: "vertical-push",
    muscles: ["shoulders", "arms"],
    equipment: "barbell",
    body: "upper",
  },
  {
    id: "lat-pulldown",
    name: "Lat Pulldown",
    aliases: ["Lat Pulldown (Cable)", "Pulldown"],
    pattern: "vertical-pull",
    muscles: ["back"],
    equipment: "cable",
    body: "upper",
  },
  {
    id: "dumbbell-row",
    name: "Dumbbell Row",
    aliases: ["Bent Over One Arm Row (Dumbbell)", "DB Row"],
    pattern: "horizontal-pull",
    muscles: ["back"],
    equipment: "dumbbell",
    body: "upper",
  },
  {
    id: "incline-db-press",
    name: "Incline Dumbbell Press",
    aliases: ["Incline Bench Press (Dumbbell)", "Incline DB Press"],
    pattern: "horizontal-push",
    muscles: ["chest", "shoulders"],
    equipment: "dumbbell",
    body: "upper",
  },
  {
    id: "dips",
    name: "Dips",
    aliases: ["Chest Dip", "Dip"],
    pattern: "accessory",
    muscles: ["chest", "arms"],
    equipment: "bodyweight",
    body: "upper",
  },
  {
    id: "goblet-squat",
    name: "Goblet Squat",
    aliases: ["Goblet Squat (Kettlebell)", "Goblet Squat (Dumbbell)"],
    pattern: "squat",
    muscles: ["legs"],
    equipment: "dumbbell",
    body: "lower",
  },
];

export const exerciseById = new Map(exercises.map((e) => [e.id, e]));

export function getExercise(id: string): Exercise {
  const exercise = exerciseById.get(id);
  if (!exercise) throw new Error(`Unknown exercise: ${id}`);
  return exercise;
}
