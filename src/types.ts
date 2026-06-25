export type IntervalKind =
  | "prepare"
  | "work"
  | "rest"
  | "restBetweenSets"
  | "cooldown";

export interface IntervalDef {
  id: string;
  kind: IntervalKind;
  name: string;
  /** Duration in seconds */
  duration: number;
  color: string;
}

export interface WorkoutExercise {
  id: string;
  name: string;
}

export interface Workout {
  id: string;
  name: string;
  /** The base sequence performed each round */
  intervals: IntervalDef[];
  /** Optional exercise rotation used for circuit-style workouts */
  exercises?: WorkoutExercise[];
  /** How many times the base sequence repeats */
  rounds: number;
  /** How many times the whole (rounds x intervals) block repeats */
  sets: number;
  /** Optional rest inserted between sets */
  restBetweenSets: number;
  createdAt: number;
  updatedAt: number;
}

/** A single flattened step ready to be played */
export interface PlaybackStep {
  kind: IntervalKind;
  name: string;
  intervalName: string;
  exerciseName?: string;
  duration: number;
  color: string;
  round: number;
  totalRounds: number;
  set: number;
  totalSets: number;
  index: number;
  total: number;
}

export const KIND_LABELS: Record<IntervalKind, string> = {
  prepare: "Preparación",
  work: "Trabajo",
  rest: "Descanso",
  restBetweenSets: "Descanso entre sets",
  cooldown: "Enfriamiento"
};

export const KIND_COLORS: Record<IntervalKind, string> = {
  prepare: "#f5a623",
  work: "#ff4d4f",
  rest: "#2ecc71",
  restBetweenSets: "#3498db",
  cooldown: "#9b59b6"
};
