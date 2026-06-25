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
      mk("prepare", "Prepárate", 10),
      mk("work", "Trabajo", 20),
      mk("rest", "Descanso", 10)
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
      mk("prepare", "Prepárate", 15),
      mk("work", "Trabajo", 40),
      mk("rest", "Descanso", 20)
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
      mk("prepare", "Prepárate", 10),
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

export function normalizeWorkout(workout: Workout): Workout {
  return {
    ...workout,
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
      mk("prepare", "Prepárate", 10),
      mk("work", "Trabajo", 30),
      mk("rest", "Descanso", 15)
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
