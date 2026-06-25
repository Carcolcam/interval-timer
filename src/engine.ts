import type { PlaybackStep, Workout } from "./types";
import { KIND_LABELS } from "./types";

/**
 * Expands a workout definition into a flat list of steps.
 * Structure: for each set -> (for each round -> base intervals) -> rest between sets
 */
export function buildSequence(workout: Workout): PlaybackStep[] {
  const steps: PlaybackStep[] = [];
  const playable = workout.intervals.filter((i) => i.duration > 0);
  const exercises = (workout.exercises ?? []).filter((e) => e.name.trim());
  let workStep = 0;

  const totalSets = Math.max(1, workout.sets);
  const totalRounds = Math.max(1, workout.rounds);

  for (let set = 1; set <= totalSets; set++) {
    for (let round = 1; round <= totalRounds; round++) {
      for (const interval of playable) {
        const intervalName = interval.name || KIND_LABELS[interval.kind];
        const exercise =
          interval.kind === "work" && exercises.length > 0
            ? exercises[workStep % exercises.length]
            : undefined;
        if (interval.kind === "work") workStep++;

        steps.push({
          kind: interval.kind,
          name: exercise?.name ?? intervalName,
          intervalName,
          exerciseName: exercise?.name,
          duration: interval.duration,
          color: interval.color,
          round,
          totalRounds,
          set,
          totalSets,
          index: 0,
          total: 0
        });
      }
    }

    const isLastSet = set === totalSets;
    if (!isLastSet && workout.restBetweenSets > 0) {
      steps.push({
        kind: "restBetweenSets",
        name: KIND_LABELS.restBetweenSets,
        intervalName: KIND_LABELS.restBetweenSets,
        duration: workout.restBetweenSets,
        color: "#3498db",
        round: totalRounds,
        totalRounds,
        set,
        totalSets,
        index: 0,
        total: 0
      });
    }
  }

  const total = steps.length;
  steps.forEach((s, i) => {
    s.index = i;
    s.total = total;
  });

  return steps;
}

export function totalDuration(workout: Workout): number {
  return buildSequence(workout).reduce((acc, s) => acc + s.duration, 0);
}

export function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
