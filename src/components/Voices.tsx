import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Workout } from "../types";
import {
  BUILTIN_VOICE_PHRASES,
  exercisePhraseId,
  type VoicePhraseDef
} from "../voices/phrases";
import { deleteVoiceClip, listVoiceClipIds } from "../voices/storage";
import { invalidateVoiceCache, previewPhrase } from "../voices/playback";
import { exportVoices, importVoices } from "../voices/export";
import { isRecordingSupported, VoiceRecorder } from "../voices/record";
import { saveVoiceClip } from "../voices/storage";
import { speak } from "../audio";

interface Props {
  workouts: Workout[];
  onBack: () => void;
}

interface PhraseRow extends VoicePhraseDef {
  recorded: boolean;
}

export function Voices({ workouts, onBack }: Props) {
  const [recordedIds, setRecordedIds] = useState<Set<string>>(new Set());
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const recorderRef = useRef(new VoiceRecorder());
  const fileRef = useRef<HTMLInputElement | null>(null);

  const refreshRecorded = useCallback(async () => {
    const ids = await listVoiceClipIds();
    setRecordedIds(new Set(ids));
  }, []);

  useEffect(() => {
    void refreshRecorded();
  }, [refreshRecorded]);

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
    } catch {
      alert(
        "No se pudo acceder al micrófono. Revisa los permisos en Ajustes del iPhone."
      );
    }
  };

  const handlePlay = async (phrase: PhraseRow) => {
    if (playingId || recordingId) return;
    setPlayingId(phrase.id);
    try {
      if (phrase.recorded) {
        await previewPhrase(phrase.id);
      } else {
        speak(phrase.tts, true);
      }
    } finally {
      setPlayingId(null);
    }
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
    const isPlaying = playingId === phrase.id;

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
            onClick={() => void handlePlay(phrase)}
            disabled={!!recordingId || isPlaying}
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
