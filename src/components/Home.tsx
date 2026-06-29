import type { Workout } from "../types";
import { formatTime, totalDuration } from "../engine";
import { APP_VERSION } from "../version";

interface Props {
  workouts: Workout[];
  onCreate: () => void;
  onPlay: (id: string) => void;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onExport: (id: string) => void;
}

export function Home({
  workouts,
  onCreate,
  onPlay,
  onEdit,
  onDuplicate,
  onDelete,
  onExport
}: Props) {
  return (
    <div className="screen home">
      <header className="home-header">
        <div>
          <h1>Intervalos</h1>
          <p className="subtitle">Tus rutinas de entrenamiento</p>
        </div>
      </header>

      <div className="list">
        {workouts.length === 0 && (
          <div className="empty">
            <p>No tienes rutinas todavía.</p>
            <button className="btn primary" onClick={onCreate}>
              Crear la primera
            </button>
          </div>
        )}

        {workouts.map((w) => {
          const dur = totalDuration(w);
          const work = w.intervals.find((i) => i.kind === "work");
          return (
            <div
              key={w.id}
              className="card"
              style={{ borderLeftColor: work?.color ?? "#ff4d4f" }}
            >
              <button className="card-main" onClick={() => onPlay(w.id)}>
                <div className="card-title">{w.name}</div>
                <div className="card-meta">
                  <span>{formatTime(dur)}</span>
                  <span>·</span>
                  <span>{w.rounds} rondas</span>
                  {(w.exercises?.length ?? 0) > 0 && (
                    <>
                      <span>·</span>
                      <span>{w.exercises?.length} ejercicios</span>
                    </>
                  )}
                  {w.sets > 1 && (
                    <>
                      <span>·</span>
                      <span>{w.sets} sets</span>
                    </>
                  )}
                </div>
              </button>
              <div className="card-actions">
                <button
                  className="icon-btn"
                  title="Editar"
                  onClick={() => onEdit(w.id)}
                >
                  ✎
                </button>
                <button
                  className="icon-btn"
                  title="Duplicar"
                  onClick={() => onDuplicate(w.id)}
                >
                  ⧉
                </button>
                <button
                  className="icon-btn"
                  title="Exportar"
                  onClick={() => onExport(w.id)}
                >
                  ⇩
                </button>
                <button
                  className="icon-btn danger"
                  title="Borrar"
                  onClick={() => {
                    if (confirm(`¿Borrar "${w.name}"?`)) onDelete(w.id);
                  }}
                >
                  🗑
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button className="fab" onClick={onCreate} aria-label="Nueva rutina">
        +
      </button>

      <p className="app-version">v{APP_VERSION}</p>
    </div>
  );
}
