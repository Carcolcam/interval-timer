import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { Workout } from "./types";
import {
  emptyWorkout,
  loadWorkouts,
  normalizeWorkout,
  saveWorkouts
} from "./storage";
import { uid } from "./utils";
import { Home } from "./components/Home";
import { Editor } from "./components/Editor";
import { Player } from "./components/Player";
import { UpdateBanner } from "./components/UpdateBanner";
import type { PlayerSettings } from "./usePlayer";

type Screen =
  | { name: "home" }
  | { name: "editor"; id: string }
  | { name: "player"; id: string };

const SETTINGS_KEY = "interval-timer:settings:v1";

function loadSettings(): PlayerSettings {
  const defaults: PlayerSettings = {
    sound: true,
    voice: true,
    vibration: true,
    mixWithMusic: true
  };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return defaults;
}

export function App() {
  const [workouts, setWorkouts] = useState<Workout[]>(() => loadWorkouts());
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const [settings, setSettings] = useState<PlayerSettings>(() => loadSettings());

  useEffect(() => {
    saveWorkouts(workouts);
  }, [workouts]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const upsert = useCallback((w: Workout) => {
    setWorkouts((prev) => {
      const idx = prev.findIndex((p) => p.id === w.id);
      const updated = { ...w, updatedAt: Date.now() };
      if (idx === -1) return [updated, ...prev];
      const copy = [...prev];
      copy[idx] = updated;
      return copy;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setWorkouts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const duplicate = useCallback((id: string) => {
    setWorkouts((prev) => {
      const src = prev.find((p) => p.id === id);
      if (!src) return prev;
      const copy: Workout = {
        ...src,
        id: uid(),
        name: `${src.name} (copia)`,
        intervals: src.intervals.map((i) => ({ ...i, id: uid() })),
        exercises: (src.exercises ?? []).map((e) => ({ ...e, id: uid() })),
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      return [copy, ...prev];
    });
  }, []);

  const createNew = useCallback(() => {
    const w = emptyWorkout();
    upsert(w);
    setScreen({ name: "editor", id: w.id });
  }, [upsert]);

  const exportWorkout = useCallback(
    (id: string) => {
      const workout = workouts.find((w) => w.id === id);
      if (!workout) return;
      const blob = new Blob([JSON.stringify(workout, null, 2)], {
        type: "application/json"
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${workout.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-|-$/g, "")}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    },
    [workouts]
  );

  const importWorkout = useCallback(
    (text: string) => {
      try {
        const parsed = JSON.parse(text) as Workout;
        if (!parsed.name || !Array.isArray(parsed.intervals)) {
          throw new Error("Invalid workout");
        }
        const imported: Workout = normalizeWorkout({
          ...parsed,
          id: uid(),
          name: `${parsed.name} (importada)`,
          intervals: parsed.intervals.map((i) => ({ ...i, id: uid() })),
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
        upsert(imported);
      } catch {
        alert("No he podido importar esa rutina. Revisa que sea un JSON válido.");
      }
    },
    [upsert]
  );

  const find = (id: string) => workouts.find((w) => w.id === id);

  let content: ReactNode;

  if (screen.name === "editor") {
    const w = find(screen.id);
    if (!w) {
      setScreen({ name: "home" });
      return null;
    }
    content = (
      <Editor
        workout={w}
        onSave={(updated) => {
          upsert(updated);
          setScreen({ name: "home" });
        }}
        onCancel={() => setScreen({ name: "home" })}
        onPlay={(updated) => {
          upsert(updated);
          setScreen({ name: "player", id: updated.id });
        }}
      />
    );
  } else if (screen.name === "player") {
    const w = find(screen.id);
    if (!w) {
      setScreen({ name: "home" });
      return null;
    }
    content = (
      <Player
        workout={w}
        settings={settings}
        onSettingsChange={setSettings}
        onExit={() => setScreen({ name: "home" })}
      />
    );
  } else {
    content = (
      <Home
        workouts={workouts}
        onCreate={createNew}
        onPlay={(id) => setScreen({ name: "player", id })}
        onEdit={(id) => setScreen({ name: "editor", id })}
        onDuplicate={duplicate}
        onDelete={remove}
        onExport={exportWorkout}
        onImport={importWorkout}
      />
    );
  }

  return (
    <>
      <UpdateBanner />
      {content}
    </>
  );
}
