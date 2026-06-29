import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Workout } from "../types";
import {
  BUILTIN_VOICE_PHRASES,
  exercisePhraseId,
  type VoicePhraseDef
} from "../voices/phrases";
import {
  deleteVoiceClip,
  getVoiceClip,
  listVoiceClipIds,
  saveVoiceClip
} from "../voices/storage";
import { invalidateVoiceCache } from "../voices/playback";
import { exportVoices, importVoices } from "../voices/export";
import { isRecordingSupported, VoiceRecorder } from "../voices/record";
import { setPlaybackSession, speak, unlockSpeech } from "../audio";

interface Props {
  workouts: Workout[];
  onBack: () => void;
}

interface PhraseRow extends VoicePhraseDef {
  recorded: boolean;
}

function micErrorMessage(error: unknown): string {
  const name =
    typeof error === "object" && error !== null && "name" in error
      ? String((error as { name?: string }).name)
      : "";

  if (name === "NotAllowedError" || name === "SecurityError") {
    return [
      "Micrófono bloqueado.",
      "",
      "En iPhone:",
      "1) Abre Safari y entra a esta misma URL.",
      "2) Toca aA > Configuración del sitio web > Micrófono > Permitir.",
      "3) Vuelve a la app y reintenta grabar."
    ].join("\n");
  }

  if (name === "NotFoundError") {
    return "No se detecta micrófono disponible en este dispositivo.";
  }

  if (name === "NotReadableError") {
    return "El micrófono está en uso por otra app (llamada, grabadora, etc.). Cierra esa app y vuelve a intentar.";
  }

  return "No se pudo acceder al micrófono. Revisa los permisos de Safari para este sitio y vuelve a intentar.";
}

export function Voices({ workouts, onBack }: Props) {
  const [recordedIds, setRecordedIds] = useState<Set<string>>(new Set());
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const recorderRef = useRef(new VoiceRecorder());
  const fileRef = useRef<HTMLInputElement | null>(null);
  // Pre-built object URLs so preview can play synchronously inside the tap
  // (iOS requires audio playback to start within the user gesture).
  const clipUrlsRef = useRef<Map<string, string>>(new Map());

  const refreshRecorded = useCallback(async () => {
    const ids = await listVoiceClipIds();
    const map = clipUrlsRef.current;
    for (const [id, url] of [...map]) {
      if (!ids.includes(id)) {
        URL.revokeObjectURL(url);
        map.delete(id);
      }
    }
    for (const id of ids) {
      if (!map.has(id)) {
        const clip = await getVoiceClip(id);
        if (clip) map.set(id, URL.createObjectURL(clip.blob));
      }
    }
    setRecordedIds(new Set(ids));
  }, []);

  useEffect(() => {
    void refreshRecorded();
  }, [refreshRecorded]);

  useEffect(() => {
    const map = clipUrlsRef.current;
    return () => {
      for (const url of map.values()) URL.revokeObjectURL(url);
      map.clear();
    };
  }, []);

  const exerciseNames = useMemo(() => {
    const names = new Set<string>();
    for (const w of workouts) {
      for (const ex of w.exercises ?? []) {
        if (ex.name.trim()) names.add(ex.name.trim());
      }
    }
    return [...names].sort((a, b) => a.localeCompare(b, "es"));
  }, [workouts]);

  const extraExerciseIds = useMemo(() => {
    return [...recordedIds].filter((id) => id.startsWith("exercise:"));
  }, [recordedIds]);

  const extraExercises = useMemo(() => {
    const fromWorkouts = new Set(exerciseNames.map(exercisePhraseId));
    return extraExerciseIds
      .filter((id) => !fromWorkouts.has(id))
      .map((id) => ({
        id,
        label: id.replace(/^exercise:/, "").replace(/-/g, " "),
        hint: "Ejercicio grabado",
        tts: id.replace(/^exercise:/, "").replace(/-/g, " ")
      }));
  }, [extraExerciseIds, exerciseNames]);

  const countdownPhrases = BUILTIN_VOICE_PHRASES.filter((p) =>
    p.id.startsWith("countdown-")
  );
  const phasePhrases = BUILTIN_VOICE_PHRASES.filter(
    (p) => !p.id.startsWith("countdown-")
  );

  const exercisePhrases: PhraseRow[] = useMemo(
    () =>
      exerciseNames.map((name) => {
        const id = exercisePhraseId(name);
        return {
          id,
          label: name,
          hint: "Nombre del ejercicio",
          tts: name,
          recorded: recordedIds.has(id)
        };
      }),
    [exerciseNames, recordedIds]
  );

  const toRow = (p: VoicePhraseDef): PhraseRow => ({
    ...p,
    recorded: recordedIds.has(p.id)
  });

  const handleRecordToggle = async (phrase: PhraseRow) => {
    if (busy) return;
    const recorder = recorderRef.current;

    if (recordingId === phrase.id) {
      setBusy(true);
      try {
        const blob = await recorder.stop();
        if (blob.size < 100) {
          alert("La grabación es demasiado corta. Inténtalo de nuevo.");
        } else {
          await saveVoiceClip(phrase.id, blob);
          invalidateVoiceCache(phrase.id);
          // Drop the stale URL so refreshRecorded rebuilds it from the new clip.
          const map = clipUrlsRef.current;
          const old = map.get(phrase.id);
          if (old) {
            URL.revokeObjectURL(old);
            map.delete(phrase.id);
          }
          await refreshRecorded();
        }
      } catch {
        alert("No se pudo guardar la grabación.");
      } finally {
        setRecordingId(null);
        setBusy(false);
      }
      return;
    }

    if (recordingId) {
      recorder.cancel();
      setRecordingId(null);
    }

    try {
      await recorder.start();
      setRecordingId(phrase.id);
    } catch (error) {
      alert(micErrorMessage(error));
    }
  };

  const handlePlay = (phrase: PhraseRow) => {
    if (recordingId) return;
    if (phrase.recorded) {
      const url = clipUrlsRef.current.get(phrase.id);
      if (url) {
        // "playback" session so it's audible even with the silent switch on.
        setPlaybackSession();
        // Play synchronously within the tap; HTMLAudio + blob URL is the most
        // reliable way to hear a recording on iOS.
        const audio = new Audio(url);
        audio.volume = 1;
        void audio.play().catch(() => {
          unlockSpeech();
          speak(phrase.tts, true);
        });
        return;
      }
    }
    unlockSpeech();
    speak(phrase.tts, true);
  };

  const handleDelete = async (phraseId: string) => {
    if (!confirm("¿Borrar esta grabación y volver a la voz automática?")) {
      return;
    }
    await deleteVoiceClip(phraseId);
    invalidateVoiceCache(phraseId);
    await refreshRecorded();
  };

  const handleExport = async () => {
    setBusy(true);
    try {
      await exportVoices();
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const count = await importVoices(file);
      await refreshRecorded();
      alert(`Se importaron ${count} grabaciones.`);
    } catch {
      alert("No he podido importar ese archivo. Revisa que sea un JSON válido.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const renderPhrase = (phrase: PhraseRow) => {
    const isRec = recordingId === phrase.id;

    return (
      <div key={phrase.id} className={`voice-row ${isRec ? "recording" : ""}`}>
        <div className="voice-row-info">
          <div className="voice-row-label">{phrase.label}</div>
          <div className="voice-row-hint">
            {phrase.hint}
            <span className="voice-status">
              {phrase.recorded ? " · Grabada" : " · Automática"}
            </span>
          </div>
        </div>
        <div className="voice-row-actions">
          <button
            className={`voice-btn record ${isRec ? "active" : ""}`}
            onClick={() => void handleRecordToggle(phrase)}
            disabled={busy && !isRec}
            aria-label={isRec ? "Detener grabación" : "Grabar"}
          >
            {isRec ? "⏹" : "●"}
          </button>
          <button
            className="voice-btn"
            onClick={() => handlePlay(phrase)}
            disabled={!!recordingId}
            aria-label="Escuchar"
          >
            ▶
          </button>
          {phrase.recorded && (
            <button
              className="voice-btn danger"
              onClick={() => void handleDelete(phrase.id)}
              disabled={!!recordingId}
              aria-label="Borrar"
            >
              🗑
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="screen voices">
      <header className="voices-header">
        <button className="btn ghost" onClick={onBack}>
          ← Volver
        </button>
        <h1>Mis voces</h1>
        <p className="voices-subtitle">
          Graba tus propias frases. Si no grabas una, se usa la voz automática.
        </p>
      </header>

      {!isRecordingSupported() && (
        <div className="voices-warning">
          Tu navegador no soporta grabación de audio. Usa Safari en iPhone.
        </div>
      )}

      <div className="voices-toolbar">
        <button className="btn ghost" onClick={() => void handleExport()} disabled={busy}>
          Exportar
        </button>
        <button
          className="btn ghost"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
        >
          Importar
        </button>
        <input
          ref={fileRef}
          className="hidden-file"
          type="file"
          accept="application/json,.json"
          onChange={(e) => void handleImport(e.target.files?.[0])}
        />
      </div>

      <section className="voices-section">
        <h2>Cuenta atrás</h2>
        {countdownPhrases.map((p) => renderPhrase(toRow(p)))}
      </section>

      <section className="voices-section">
        <h2>Fases</h2>
        {phasePhrases.map((p) => renderPhrase(toRow(p)))}
      </section>

      {exercisePhrases.length > 0 && (
        <section className="voices-section">
          <h2>Ejercicios de tus rutinas</h2>
          <p className="voices-section-hint">
            Graba el nombre de cada ejercicio para que suene durante el entreno.
          </p>
          {exercisePhrases.map(renderPhrase)}
        </section>
      )}

      {extraExercises.length > 0 && (
        <section className="voices-section">
          <h2>Otras grabaciones</h2>
          {extraExercises.map((p) => renderPhrase(toRow(p)))}
        </section>
      )}

      {exercisePhrases.length === 0 && (
        <section className="voices-section">
          <h2>Ejercicios</h2>
          <p className="voices-section-hint muted">
            Añade ejercicios a una rutina para poder grabar sus nombres aquí.
          </p>
        </section>
      )}
    </div>
  );
}
