import type { IntervalDef, Workout } from "./types";
import { KIND_COLORS } from "./types";
import { uid } from "./utils";

const KEY = "interval-timer:workouts:v1";

function mk(
  kind: IntervalDef["kind"],
  name: string,
  duration: number
): IntervalDef {
  return { id: uid(), kind, name, duration, color: KIND_COLORS[kind] };
}

export function defaultWorkouts(): Workout[] {
  const now = Date.now();
  const tabata: Workout = {
    id: uid(),
    name: "Tabata clásico",
    intervals: [
      mk("prepare", "¿Listos?", 10),
      mk("work", "¡Vamos!", 20),
      mk("rest", "Respira", 10)
    ],
    rounds: 8,
    sets: 1,
    restBetweenSets: 60,
    exercises: [
      { id: uid(), name: "Burpees" },
      { id: uid(), name: "Sentadillas" },
      { id: uid(), name: "Flexiones" },
      { id: uid(), name: "Mountain climbers" }
    ],
    createdAt: now,
    updatedAt: now
  };

  const hiit: Workout = {
    id: uid(),
    name: "HIIT 40/20",
    intervals: [
      mk("prepare", "¿Listos?", 15),
      mk("work", "¡Vamos!", 40),
      mk("rest", "Respira", 20)
    ],
    rounds: 6,
    sets: 3,
    restBetweenSets: 90,
    exercises: [
      { id: uid(), name: "Jumping jacks" },
      { id: uid(), name: "Zancadas" },
      { id: uid(), name: "Plancha" }
    ],
    createdAt: now,
    updatedAt: now
  };

  const circuit: Workout = {
    id: uid(),
    name: "Circuito full body",
    intervals: [
      mk("prepare", "¿Listos?", 10),
      mk("work", "Ejercicio", 45),
      mk("rest", "Cambio", 15)
    ],
    rounds: 8,
    sets: 2,
    restBetweenSets: 75,
    exercises: [
      { id: uid(), name: "Sentadilla con salto" },
      { id: uid(), name: "Flexiones" },
      { id: uid(), name: "Remo con banda" },
      { id: uid(), name: "Plancha" },
      { id: uid(), name: "Zancadas" },
      { id: uid(), name: "Abdominales" },
      { id: uid(), name: "Burpees" },
      { id: uid(), name: "Mountain climbers" }
    ],
    createdAt: now,
    updatedAt: now
  };

  return [tabata, hiit, circuit];
}

// Migrate names from the old wording to the new motivating words.
const NAME_MIGRATION: Record<string, string> = {
  "Preparación": "¿Listos?",
  "Prepárate": "¿Listos?",
  "Trabajo": "¡Vamos!",
  "Descanso": "Respira",
  "Descanso entre sets": "Recupera"
};

export function normalizeWorkout(workout: Workout): Workout {
  return {
    ...workout,
    intervals: workout.intervals.map((interval) => ({
      ...interval,
      name: NAME_MIGRATION[interval.name] ?? interval.name
    })),
    exercises: (workout.exercises ?? []).map((exercise) => ({
      id: exercise.id || uid(),
      name: exercise.name || "Ejercicio"
    }))
  };
}

export function loadWorkouts(): Workout[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const seeded = defaultWorkouts();
      saveWorkouts(seeded);
      return seeded;
    }
    return (JSON.parse(raw) as Workout[]).map(normalizeWorkout);
  } catch {
    return defaultWorkouts();
  }
}

export function saveWorkouts(workouts: Workout[]): void {
  localStorage.setItem(KEY, JSON.stringify(workouts));
}

export function emptyWorkout(): Workout {
  const now = Date.now();
  return {
    id: uid(),
    name: "Nueva rutina",
    intervals: [
      mk("prepare", "¿Listos?", 10),
      mk("work", "¡Vamos!", 30),
      mk("rest", "Respira", 15)
    ],
    exercises: [
      { id: uid(), name: "Ejercicio 1" },
      { id: uid(), name: "Ejercicio 2" }
    ],
    rounds: 5,
    sets: 1,
    restBetweenSets: 60,
    createdAt: now,
    updatedAt: now
  };
}
