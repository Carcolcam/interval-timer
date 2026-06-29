import { useEffect, useRef, useState } from "react";
import type { Workout } from "../types";
import { KIND_LABELS } from "../types";
import { formatTime } from "../engine";
import { usePlayer } from "../usePlayer";
import type { PlayerSettings } from "../usePlayer";
import { unlockAudio, unlockSpeech, setAudioMixWithMusic } from "../audio";
import { confirmKeepAwake, useKeepAwake } from "../useKeepAwake";
import { ProgressRing } from "./ProgressRing";

interface Props {
  workout: Workout;
  settings: PlayerSettings;
  onSettingsChange: (s: PlayerSettings) => void;
  onExit: () => void;
  onOpenVoices?: () => void;
}

export function Player({
  workout,
  settings,
  onSettingsChange,
  onExit,
  onOpenVoices
}: Props) {
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
  const [menuOpen, setMenuOpen] = useState(false);
  const lastFlashSec = useRef(-1);
  const menuRef = useRef<HTMLDivElement | null>(null);

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
    if (!menuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen]);

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
        <div className="player-menu" ref={menuRef}>
          <button
            className={`btn ghost light hamburger ${menuOpen ? "open" : ""}`}
            onClick={() => {
              unlockAudio();
              setMenuOpen((o) => !o);
            }}
            aria-label="Ajustes"
            aria-expanded={menuOpen}
          >
            <span className="hamburger-bars" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>

          {menuOpen && (
            <div className="player-menu-panel" role="menu">
              <div className="menu-section-title">Música</div>
              <button
                className="menu-item"
                role="menuitemcheckbox"
                aria-checked={settings.mixWithMusic}
                onClick={() => {
                  unlockAudio();
                  toggleSetting("mixWithMusic");
                }}
              >
                <span className="menu-item-label">🎵 Mezclar con música</span>
                <span className={`menu-switch ${settings.mixWithMusic ? "on" : ""}`} />
              </button>
              <button
                className={`menu-item menu-item-sub ${!settings.mixWithMusic ? "disabled" : ""}`}
                role="menuitemcheckbox"
                aria-checked={settings.duckMusic}
                aria-disabled={!settings.mixWithMusic}
                onClick={() => {
                  if (!settings.mixWithMusic) return;
                  unlockAudio();
                  toggleSetting("duckMusic");
                }}
              >
                <span className="menu-item-label">🔉 Bajar al hablar</span>
                <span className={`menu-switch ${settings.duckMusic ? "on" : ""}`} />
              </button>

              <div className="menu-section-title">Avisos</div>
              <button
                className="menu-item"
                role="menuitemcheckbox"
                aria-checked={settings.sound}
                onClick={() => {
                  unlockAudio();
                  toggleSetting("sound");
                }}
              >
                <span className="menu-item-label">🔔 Pitidos</span>
                <span className={`menu-switch ${settings.sound ? "on" : ""}`} />
              </button>
              <button
                className="menu-item"
                role="menuitemcheckbox"
                aria-checked={settings.voice}
                onClick={() => toggleSetting("voice")}
              >
                <span className="menu-item-label">🗣 Voz</span>
                <span className={`menu-switch ${settings.voice ? "on" : ""}`} />
              </button>
              <button
                className={`menu-item menu-item-sub ${!settings.voice ? "disabled" : ""}`}
                role="menuitemcheckbox"
                aria-checked={settings.voiceCountdownOnly}
                aria-disabled={!settings.voice}
                onClick={() => {
                  if (!settings.voice) return;
                  toggleSetting("voiceCountdownOnly");
                }}
              >
                <span className="menu-item-label">🔢 Solo números</span>
                <span
                  className={`menu-switch ${settings.voiceCountdownOnly ? "on" : ""}`}
                />
              </button>
              <button
                className={`menu-item menu-item-sub ${!settings.voice ? "disabled" : ""}`}
                role="menuitemcheckbox"
                aria-checked={settings.useCustomVoices}
                aria-disabled={!settings.voice}
                onClick={() => {
                  if (!settings.voice) return;
                  toggleSetting("useCustomVoices");
                }}
              >
                <span className="menu-item-label">🎙 Usar mis voces</span>
                <span
                  className={`menu-switch ${settings.useCustomVoices ? "on" : ""}`}
                />
              </button>
              <button
                className="menu-item"
                role="menuitemcheckbox"
                aria-checked={settings.vibration}
                onClick={() => toggleSetting("vibration")}
              >
                <span className="menu-item-label">📳 Vibración</span>
                <span className={`menu-switch ${settings.vibration ? "on" : ""}`} />
              </button>

              {onOpenVoices && (
                <>
                  <div className="menu-section-title">Mis voces</div>
                  <button
                    className="menu-item menu-item-link"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenVoices();
                    }}
                  >
                    <span className="menu-item-label">🎤 Grabar mis voces…</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

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
            unlockSpeech();
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
