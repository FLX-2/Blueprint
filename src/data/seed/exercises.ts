import type { Equipment, Exercise, MovementPattern, MuscleGroup } from "@/lib/domain/types";

const ex = (
  id: string,
  name: string,
  aliases: string[],
  pattern: MovementPattern,
  muscles: MuscleGroup[],
  equipment: Equipment,
  body: Exercise["body"],
): Exercise => ({ id, name, aliases, pattern, muscles, equipment, body });

/**
 * The exercise library. Imported names are matched against `name` and
 * `aliases`; the first alias is what the demo CSV uses for older sessions.
 */
export const exercises: Exercise[] = [
  // Squat
  ex("back-squat", "Back Squat", ["Squat (Barbell)", "BB Squat", "squat"], "squat", ["legs"], "barbell", "lower"),
  ex("front-squat", "Front Squat", ["Front Squat (Barbell)"], "squat", ["legs"], "barbell", "lower"),
  ex("goblet-squat", "Goblet Squat", ["Goblet Squat (Kettlebell)", "Goblet Squat (Dumbbell)"], "squat", ["legs"], "dumbbell", "lower"),
  ex("leg-press", "Leg Press", ["Leg Press (Machine)", "Leg Press (Sled)"], "squat", ["legs"], "machine", "lower"),
  ex("bulgarian-split-squat", "Bulgarian Split Squat", ["Bulgarian Split Squat (Dumbbell)", "Rear Foot Elevated Split Squat"], "squat", ["legs"], "dumbbell", "lower"),
  ex("lunge", "Walking Lunge", ["Lunge (Dumbbell)", "Walking Lunge (Dumbbell)", "Lunges"], "squat", ["legs"], "dumbbell", "lower"),
  ex("leg-extension", "Leg Extension", ["Leg Extension (Machine)"], "accessory", ["legs"], "machine", "lower"),

  // Hinge
  ex("deadlift", "Deadlift", ["Deadlift (Barbell)", "Conventional Deadlift", "DL"], "hinge", ["legs", "back"], "barbell", "lower"),
  ex("romanian-deadlift", "Romanian Deadlift", ["Romanian Deadlift (Barbell)", "RDL"], "hinge", ["legs", "back"], "barbell", "lower"),
  ex("sumo-deadlift", "Sumo Deadlift", ["Sumo Deadlift (Barbell)"], "hinge", ["legs", "back"], "barbell", "lower"),
  ex("hip-thrust", "Hip Thrust", ["Hip Thrust (Barbell)", "Barbell Hip Thrust"], "hinge", ["legs"], "barbell", "lower"),
  ex("leg-curl", "Leg Curl", ["Lying Leg Curl (Machine)", "Seated Leg Curl (Machine)", "Hamstring Curl"], "accessory", ["legs"], "machine", "lower"),
  ex("calf-raise", "Calf Raise", ["Standing Calf Raise (Machine)", "Seated Calf Raise (Machine)"], "accessory", ["legs"], "machine", "lower"),

  // Horizontal push
  ex("bench-press", "Bench Press", ["Bench Press (Barbell)", "BB Bench", "bench"], "horizontal-push", ["chest", "arms"], "barbell", "upper"),
  ex("incline-bench-press", "Incline Bench Press", ["Incline Bench Press (Barbell)"], "horizontal-push", ["chest", "shoulders"], "barbell", "upper"),
  ex("close-grip-bench-press", "Close-Grip Bench Press", ["Close Grip Bench Press (Barbell)", "CGBP"], "horizontal-push", ["chest", "arms"], "barbell", "upper"),
  ex("dumbbell-bench-press", "Dumbbell Bench Press", ["Bench Press (Dumbbell)", "DB Bench"], "horizontal-push", ["chest", "arms"], "dumbbell", "upper"),
  ex("incline-db-press", "Incline Dumbbell Press", ["Incline Bench Press (Dumbbell)", "Incline DB Press"], "horizontal-push", ["chest", "shoulders"], "dumbbell", "upper"),
  ex("chest-fly", "Chest Fly", ["Chest Fly (Dumbbell)", "Cable Fly", "Pec Deck (Machine)"], "accessory", ["chest"], "cable", "upper"),
  ex("dips", "Dips", ["Chest Dip", "Dip"], "accessory", ["chest", "arms"], "bodyweight", "upper"),
  ex("push-up", "Push-Up", ["Push Up", "Pushups"], "horizontal-push", ["chest", "arms"], "bodyweight", "upper"),

  // Vertical push
  ex("overhead-press", "Overhead Press", ["Overhead Press (Barbell)", "OHP", "Strict Press"], "vertical-push", ["shoulders", "arms"], "barbell", "upper"),
  ex("dumbbell-shoulder-press", "Dumbbell Shoulder Press", ["Shoulder Press (Dumbbell)", "Seated DB Press"], "vertical-push", ["shoulders", "arms"], "dumbbell", "upper"),
  ex("lateral-raise", "Lateral Raise", ["Lateral Raise (Dumbbell)", "Side Raise"], "accessory", ["shoulders"], "dumbbell", "upper"),
  ex("face-pull", "Face Pull", ["Face Pull (Cable)"], "accessory", ["shoulders", "back"], "cable", "upper"),

  // Vertical pull
  ex("pull-up", "Pull-Up", ["Pull Up", "Pullups", "Chin Up"], "vertical-pull", ["back", "arms"], "bodyweight", "upper"),
  ex("lat-pulldown", "Lat Pulldown", ["Lat Pulldown (Cable)", "Pulldown"], "vertical-pull", ["back"], "cable", "upper"),

  // Horizontal pull
  ex("barbell-row", "Barbell Row", ["Bent Over Row (Barbell)", "Pendlay Row (Barbell)", "BB Row"], "horizontal-pull", ["back"], "barbell", "upper"),
  ex("dumbbell-row", "Dumbbell Row", ["Bent Over One Arm Row (Dumbbell)", "DB Row"], "horizontal-pull", ["back"], "dumbbell", "upper"),
  ex("seated-cable-row", "Seated Cable Row", ["Seated Row (Cable)", "Cable Row"], "horizontal-pull", ["back"], "cable", "upper"),

  // Arms
  ex("barbell-curl", "Barbell Curl", ["Bicep Curl (Barbell)", "EZ Bar Curl"], "accessory", ["arms"], "barbell", "upper"),
  ex("dumbbell-curl", "Dumbbell Curl", ["Bicep Curl (Dumbbell)", "DB Curl"], "accessory", ["arms"], "dumbbell", "upper"),
  ex("hammer-curl", "Hammer Curl", ["Hammer Curl (Dumbbell)"], "accessory", ["arms"], "dumbbell", "upper"),
  ex("triceps-pushdown", "Triceps Pushdown", ["Triceps Pushdown (Cable - Straight Bar)", "Tricep Pushdown", "Rope Pushdown"], "accessory", ["arms"], "cable", "upper"),
  ex("skull-crusher", "Skull Crusher", ["Skullcrusher (Barbell)", "Lying Triceps Extension"], "accessory", ["arms"], "barbell", "upper"),
];

export const exerciseById = new Map(exercises.map((e) => [e.id, e]));

export function getExercise(id: string): Exercise {
  const exercise = exerciseById.get(id);
  if (!exercise) throw new Error(`Unknown exercise: ${id}`);
  return exercise;
}
