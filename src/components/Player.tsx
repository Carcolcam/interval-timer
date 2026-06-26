import { useEffect, useRef, useState } from "react";
import type { Workout } from "../types";
import { KIND_LABELS } from "../types";
import { formatTime } from "../engine";
import { usePlayer } from "../usePlayer";
import type { PlayerSettings } from "../usePlayer";
import { unlockAudio, setAudioMixWithMusic } from "../audio";
import { confirmKeepAwake, useKeepAwake } from "../useKeepAwake";
import { ProgressRing } from "./ProgressRing";

interface Props {
  workout: Workout;
  settings: PlayerSettings;
  onSettingsChange: (s: PlayerSettings) => void;
  onExit: () => void;
}

export function Player({ workout, settings, onSettingsChange, onExit }: Props) {
  const player = usePlayer(workout, settings);
  useKeepAwake(true);

  const {
    current,
    next,
    remaining,
    running,
    finished,
    toggle,
    reset,
    skipNext,
    skipPrev,
    elapsedTotal,
    totalTime,
    currentIndex,
    steps
  } = player;

  const [flashClass, setFlashClass] = useState("");
  const [showMusicHint, setShowMusicHint] = useState(true);
  const lastFlashSec = useRef(-1);

  const wholeRemaining = Math.ceil(remaining);
  const inCountdown =
    running && !finished && wholeRemaining <= 5 && wholeRemaining > 0;
  const isWorkPhase = current?.kind === "work";

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    setAudioMixWithMusic(settings.mixWithMusic);
  }, [settings.mixWithMusic]);

  useEffect(() => {
    if (!inCountdown || wholeRemaining === lastFlashSec.current) return;
    lastFlashSec.current = wholeRemaining;

    if (wholeRemaining === 1 && isWorkPhase) {
      setFlashClass("flash-nuke");
    } else if (wholeRemaining === 2 && isWorkPhase) {
      setFlashClass("flash-long");
    } else {
      setFlashClass(`flash-${wholeRemaining}`);
    }

    const ms =
      wholeRemaining === 1 && isWorkPhase
        ? 3000
        : wholeRemaining === 2 && isWorkPhase
          ? 2000
          : 220;
    const timer = window.setTimeout(() => setFlashClass(""), ms);
    return () => window.clearTimeout(timer);
  }, [inCountdown, wholeRemaining, isWorkPhase]);

  useEffect(() => {
    if (!inCountdown) lastFlashSec.current = -1;
  }, [inCountdown]);

  const bg = finished ? "#10381f" : current?.color ?? "#0b0f14";
  const ringProgress =
    current && current.duration > 0 ? remaining / current.duration : 0;

  const toggleSetting = (key: keyof PlayerSettings) =>
    onSettingsChange({ ...settings, [key]: !settings[key] });

  return (
    <div
      className={`screen player ${flashClass}`}
      style={{ background: bg }}
    >
      <div className="player-flash-overlay" aria-hidden="true" />

      <div className="player-top">
        <button className="btn ghost light" onClick={onExit}>
          ✕
        </button>
        <div className="player-title">{workout.name}</div>
        <div className="player-toggles">
          <button
            className={`pill ${settings.mixWithMusic ? "on" : ""}`}
            onClick={() => {
              unlockAudio();
              toggleSetting("mixWithMusic");
            }}
            title="Mezclar con música"
          >
            🎵
          </button>
          <button
            className={`pill ${settings.sound ? "on" : ""}`}
            onClick={() => {
              unlockAudio();
              toggleSetting("sound");
            }}
            title="Sonido"
          >
            🔊
          </button>
          <button
            className={`pill ${settings.voice ? "on" : ""}`}
            onClick={() => toggleSetting("voice")}
            title="Voz"
          >
            🗣
          </button>
          <button
            className={`pill ${settings.vibration ? "on" : ""}`}
            onClick={() => toggleSetting("vibration")}
            title="Vibración"
          >
            📳
          </button>
        </div>
      </div>

      {settings.mixWithMusic && showMusicHint && (
        <div className="music-hint">
          <span>
            🎵 Con música puesta, iPhone no puede bajarla para los avisos. Si no
            oyes los pitidos, apaga 🎵 (la música se pausará un instante en cada
            aviso).
          </span>
          <button
            className="music-hint-close"
            onClick={() => setShowMusicHint(false)}
            aria-label="Cerrar aviso"
          >
            ✕
          </button>
        </div>
      )}

      <div className="player-center">
        {finished ? (
          <div className="finished">
            <div className="finished-emoji">✅</div>
            <h2>¡Completado!</h2>
            <p>{formatTime(totalTime)} de entrenamiento</p>
          </div>
        ) : (
          <>
            <div className="phase-label">
              {current ? KIND_LABELS[current.kind] : ""}
            </div>
            <ProgressRing progress={ringProgress} color="#ffffff">
              <div className="ring-content">
                <div className="big-time">{formatTime(remaining)}</div>
                {current && current.name !== KIND_LABELS[current.kind] && (
                  <div className="phase-name">{current.name}</div>
                )}
                {current?.exerciseName && (
                  <div className="interval-caption">{current.intervalName}</div>
                )}
              </div>
            </ProgressRing>

            <div className="counters">
              <div className="counter">
                <span className="counter-value">
                  {current?.round}/{current?.totalRounds}
                </span>
                <span className="counter-label">Ronda</span>
              </div>
              {current && current.totalSets > 1 && (
                <div className="counter">
                  <span className="counter-value">
                    {current.set}/{current.totalSets}
                  </span>
                  <span className="counter-label">Set</span>
                </div>
              )}
              <div className="counter">
                <span className="counter-value">
                  {currentIndex + 1}/{steps.length}
                </span>
                <span className="counter-label">Paso</span>
              </div>
            </div>

            {next && (
              <div className="next-up">
                Siguiente: <strong>{next.name}</strong> ·{" "}
                {next.exerciseName ? `${next.intervalName} · ` : ""}
                {formatTime(next.duration)}
              </div>
            )}
          </>
        )}
      </div>

      <div className="player-progress">
        <div
          className="player-progress-bar"
          style={{
            width: `${totalTime > 0 ? (elapsedTotal / totalTime) * 100 : 0}%`
          }}
        />
      </div>

      <div className="player-controls">
        <button className="ctrl" onClick={skipPrev} aria-label="Anterior">
          ⏮
        </button>
        <button
          className="ctrl main"
          onClick={() => {
            unlockAudio();
            confirmKeepAwake();
            toggle();
          }}
          aria-label={running ? "Pausa" : "Iniciar"}
        >
          {running ? "⏸" : "▶"}
        </button>
        <button className="ctrl" onClick={skipNext} aria-label="Siguiente">
          ⏭
        </button>
        <button className="ctrl" onClick={reset} aria-label="Reiniciar">
          ↺
        </button>
      </div>
    </div>
  );
}
