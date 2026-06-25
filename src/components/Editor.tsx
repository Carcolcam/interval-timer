import { useState } from "react";
import type {
  IntervalDef,
  IntervalKind,
  Workout,
  WorkoutExercise
} from "../types";
import { KIND_COLORS, KIND_LABELS } from "../types";
import { formatTime, totalDuration } from "../engine";
import { clamp, uid } from "../utils";

interface Props {
  workout: Workout;
  onSave: (w: Workout) => void;
  onCancel: () => void;
  onPlay: (w: Workout) => void;
}

const KIND_OPTIONS: IntervalKind[] = [
  "prepare",
  "work",
  "rest",
  "cooldown"
];

export function Editor({ workout, onSave, onCancel, onPlay }: Props) {
  const [draft, setDraft] = useState<Workout>(() => ({
    ...workout,
    intervals: workout.intervals.map((i) => ({ ...i })),
    exercises: (workout.exercises ?? []).map((e) => ({ ...e }))
  }));

  const update = (patch: Partial<Workout>) =>
    setDraft((d) => ({ ...d, ...patch }));

  const updateInterval = (id: string, patch: Partial<IntervalDef>) =>
    setDraft((d) => ({
      ...d,
      intervals: d.intervals.map((i) => (i.id === id ? { ...i, ...patch } : i))
    }));

  const addInterval = () =>
    setDraft((d) => ({
      ...d,
      intervals: [
        ...d.intervals,
        {
          id: uid(),
          kind: "work",
          name: "Trabajo",
          duration: 30,
          color: KIND_COLORS.work
        }
      ]
    }));

  const removeInterval = (id: string) =>
    setDraft((d) => ({
      ...d,
      intervals: d.intervals.filter((i) => i.id !== id)
    }));

  const move = (index: number, dir: -1 | 1) =>
    setDraft((d) => {
      const arr = [...d.intervals];
      const target = index + dir;
      if (target < 0 || target >= arr.length) return d;
      [arr[index], arr[target]] = [arr[target], arr[index]];
      return { ...d, intervals: arr };
    });

  const updateExercise = (id: string, patch: Partial<WorkoutExercise>) =>
    setDraft((d) => ({
      ...d,
      exercises: (d.exercises ?? []).map((e) =>
        e.id === id ? { ...e, ...patch } : e
      )
    }));

  const addExercise = () =>
    setDraft((d) => ({
      ...d,
      exercises: [
        ...(d.exercises ?? []),
        { id: uid(), name: `Ejercicio ${(d.exercises?.length ?? 0) + 1}` }
      ]
    }));

  const removeExercise = (id: string) =>
    setDraft((d) => ({
      ...d,
      exercises: (d.exercises ?? []).filter((e) => e.id !== id)
    }));

  const moveExercise = (index: number, dir: -1 | 1) =>
    setDraft((d) => {
      const arr = [...(d.exercises ?? [])];
      const target = index + dir;
      if (target < 0 || target >= arr.length) return d;
      [arr[index], arr[target]] = [arr[target], arr[index]];
      return { ...d, exercises: arr };
    });

  return (
    <div className="screen editor">
      <header className="editor-header">
        <button className="btn ghost" onClick={onCancel}>
          ← Cancelar
        </button>
        <span className="editor-total">{formatTime(totalDuration(draft))}</span>
        <button className="btn primary" onClick={() => onSave(draft)}>
          Guardar
        </button>
      </header>

      <div className="editor-body">
        <label className="field">
          <span>Nombre</span>
          <input
            type="text"
            value={draft.name}
            onChange={(e) => update({ name: e.target.value })}
          />
        </label>

        <div className="grid-2">
          <NumberField
            label="Rondas"
            value={draft.rounds}
            min={1}
            max={99}
            onChange={(v) => update({ rounds: v })}
          />
          <NumberField
            label="Sets"
            value={draft.sets}
            min={1}
            max={99}
            onChange={(v) => update({ sets: v })}
          />
        </div>

        {draft.sets > 1 && (
          <NumberField
            label="Descanso entre sets (s)"
            value={draft.restBetweenSets}
            min={0}
            max={600}
            step={5}
            onChange={(v) => update({ restBetweenSets: v })}
          />
        )}

        <h2 className="section-title">Intervalos (por ronda)</h2>

        <div className="intervals">
          {draft.intervals.map((interval, idx) => (
            <div
              className="interval-row"
              key={interval.id}
              style={{ borderLeftColor: interval.color }}
            >
              <div className="interval-top">
                <select
                  value={interval.kind}
                  onChange={(e) => {
                    const kind = e.target.value as IntervalKind;
                    updateInterval(interval.id, {
                      kind,
                      color: KIND_COLORS[kind],
                      name: KIND_LABELS[kind]
                    });
                  }}
                >
                  {KIND_OPTIONS.map((k) => (
                    <option key={k} value={k}>
                      {KIND_LABELS[k]}
                    </option>
                  ))}
                </select>
                <input
                  className="color-input"
                  type="color"
                  value={interval.color}
                  onChange={(e) =>
                    updateInterval(interval.id, { color: e.target.value })
                  }
                />
              </div>

              <input
                className="interval-name"
                type="text"
                value={interval.name}
                placeholder="Nombre"
                onChange={(e) =>
                  updateInterval(interval.id, { name: e.target.value })
                }
              />

              <div className="interval-bottom">
                <div className="stepper">
                  <button
                    onClick={() =>
                      updateInterval(interval.id, {
                        duration: clamp(interval.duration - 5, 1, 3600)
                      })
                    }
                  >
                    −
                  </button>
                  <span>{interval.duration}s</span>
                  <button
                    onClick={() =>
                      updateInterval(interval.id, {
                        duration: clamp(interval.duration + 5, 1, 3600)
                      })
                    }
                  >
                    +
                  </button>
                </div>
                <div className="interval-move">
                  <button onClick={() => move(idx, -1)} disabled={idx === 0}>
                    ↑
                  </button>
                  <button
                    onClick={() => move(idx, 1)}
                    disabled={idx === draft.intervals.length - 1}
                  >
                    ↓
                  </button>
                  <button
                    className="icon-btn danger"
                    onClick={() => removeInterval(interval.id)}
                  >
                    🗑
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button className="btn ghost full" onClick={addInterval}>
          + Añadir intervalo
        </button>

        <h2 className="section-title">Circuito de ejercicios</h2>
        <p className="hint">
          Estos nombres se asignan a los intervalos de trabajo en orden. Si la
          lista queda vacía, se usará el nombre del intervalo.
        </p>

        <div className="exercises">
          {(draft.exercises ?? []).map((exercise, idx) => (
            <div className="exercise-row" key={exercise.id}>
              <span className="exercise-index">{idx + 1}</span>
              <input
                className="exercise-name"
                type="text"
                value={exercise.name}
                placeholder="Nombre del ejercicio"
                onChange={(e) =>
                  updateExercise(exercise.id, { name: e.target.value })
                }
              />
              <div className="interval-move">
                <button
                  onClick={() => moveExercise(idx, -1)}
                  disabled={idx === 0}
                >
                  ↑
                </button>
                <button
                  onClick={() => moveExercise(idx, 1)}
                  disabled={idx === (draft.exercises?.length ?? 0) - 1}
                >
                  ↓
                </button>
                <button
                  className="icon-btn danger"
                  onClick={() => removeExercise(exercise.id)}
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>

        <button className="btn ghost full" onClick={addExercise}>
          + Añadir ejercicio
        </button>

        <button
          className="btn primary full play-btn"
          onClick={() => onPlay(draft)}
        >
          ▶ Probar ahora
        </button>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="field">
      <span>{label}</span>
      <div className="stepper">
        <button onClick={() => onChange(clamp(value - step, min, max))}>−</button>
        <span>{value}</span>
        <button onClick={() => onChange(clamp(value + step, min, max))}>+</button>
      </div>
    </div>
  );
}
