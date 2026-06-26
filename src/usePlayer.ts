import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PlaybackStep, Workout } from "./types";
import { buildSequence } from "./engine";
import {
  beepCountdown,
  beepFinish,
  beepGo,
  speak,
  vibrate
} from "./audio";

export interface PlayerSettings {
  sound: boolean;
  voice: boolean;
  vibration: boolean;
  /** When true, timer audio mixes with Spotify/Apple Music instead of pausing it. */
  mixWithMusic: boolean;
}

export interface PlayerState {
  steps: PlaybackStep[];
  currentIndex: number;
  remaining: number; // seconds remaining in current step
  running: boolean;
  finished: boolean;
  current: PlaybackStep | null;
  next: PlaybackStep | null;
  elapsedTotal: number;
  totalTime: number;
  start: () => void;
  pause: () => void;
  toggle: () => void;
  reset: () => void;
  skipNext: () => void;
  skipPrev: () => void;
}

export function usePlayer(
  workout: Workout,
  settings: PlayerSettings
): PlayerState {
  const steps = useMemo(() => buildSequence(workout), [workout]);
  const totalTime = useMemo(
    () => steps.reduce((a, s) => a + s.duration, 0),
    [steps]
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [remaining, setRemaining] = useState(steps[0]?.duration ?? 0);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);

  const rafRef = useRef<number | null>(null);
  const stepEndRef = useRef<number>(0);
  const lastWholeRef = useRef<number>(-1);
  const currentIndexRef = useRef(0);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  currentIndexRef.current = currentIndex;

  const current = steps[currentIndex] ?? null;
  const next = steps[currentIndex + 1] ?? null;

  const announce = useCallback((step: PlaybackStep) => {
    const s = settingsRef.current;
    if (s.sound) beepGo();
    if (s.vibration) vibrate(200);
    if (s.voice) speak(step.name, true);
  }, []);

  const stopLoop = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const goToStep = useCallback(
    (index: number, autostart: boolean) => {
      const step = steps[index];
      if (!step) return;
      setCurrentIndex(index);
      setRemaining(step.duration);
      lastWholeRef.current = step.duration;
      stepEndRef.current = performance.now() + step.duration * 1000;
      if (autostart) announce(step);
    },
    [steps, announce]
  );

  const tick = useCallback(() => {
    const now = performance.now();
    const msLeft = stepEndRef.current - now;
    const secLeft = Math.max(0, msLeft / 1000);
    setRemaining(secLeft);

    const whole = Math.ceil(secLeft);
    if (whole !== lastWholeRef.current) {
      lastWholeRef.current = whole;
      const s = settingsRef.current;
      const step = steps[currentIndexRef.current];
      const isWork = step?.kind === "work";
      if (whole <= 5 && whole > 0) {
        if (s.sound) beepCountdown(whole, isWork);
        // Spoken countdown ducks music on iOS, so it's audible over Spotify.
        if (s.voice && whole <= 3) {
          const words: Record<number, string> = {
            3: "tres",
            2: "dos",
            1: "uno"
          };
          speak(words[whole], true);
        }
        if (s.vibration) {
          if (isWork && whole === 1) vibrate([300, 80, 300]);
          else if (isWork && whole === 2) vibrate(250);
          else if (whole === 3) vibrate(140);
          else vibrate(90);
        }
      }
    }

    if (msLeft <= 0) {
      setCurrentIndex((idx) => {
        const nextIdx = idx + 1;
        const nextStep = steps[nextIdx];
        if (!nextStep) {
          setRunning(false);
          setFinished(true);
          setRemaining(0);
          const s = settingsRef.current;
          if (s.sound) beepFinish();
          if (s.vibration) vibrate([200, 100, 200]);
          if (s.voice) speak("Terminado", true);
          stopLoop();
          return idx;
        }
        setRemaining(nextStep.duration);
        lastWholeRef.current = nextStep.duration;
        stepEndRef.current = performance.now() + nextStep.duration * 1000;
        announce(nextStep);
        return nextIdx;
      });
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [steps, stopLoop, announce]);

  const start = useCallback(() => {
    if (finished) {
      goToStep(0, true);
      setFinished(false);
    } else {
      stepEndRef.current = performance.now() + remaining * 1000;
      if (current) announce(current);
    }
    setRunning(true);
  }, [finished, remaining, current, announce, goToStep]);

  const pause = useCallback(() => {
    setRunning(false);
  }, []);

  const toggle = useCallback(() => {
    if (running) pause();
    else start();
  }, [running, start, pause]);

  const reset = useCallback(() => {
    setRunning(false);
    setFinished(false);
    goToStep(0, false);
  }, [goToStep]);

  const skipNext = useCallback(() => {
    const target = Math.min(currentIndex + 1, steps.length - 1);
    goToStep(target, running);
  }, [currentIndex, steps.length, goToStep, running]);

  const skipPrev = useCallback(() => {
    const target = Math.max(currentIndex - 1, 0);
    goToStep(target, running);
  }, [currentIndex, goToStep, running]);

  useEffect(() => {
    if (running) {
      stepEndRef.current = performance.now() + remaining * 1000;
      rafRef.current = requestAnimationFrame(tick);
      return () => stopLoop();
    }
    stopLoop();
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, tick, stopLoop]);

  const elapsedBefore = useMemo(() => {
    let acc = 0;
    for (let i = 0; i < currentIndex; i++) acc += steps[i].duration;
    return acc;
  }, [currentIndex, steps]);

  const elapsedTotal = elapsedBefore + ((current?.duration ?? 0) - remaining);

  return {
    steps,
    currentIndex,
    remaining,
    running,
    finished,
    current,
    next,
    elapsedTotal,
    totalTime,
    start,
    pause,
    toggle,
    reset,
    skipNext,
    skipPrev
  };
}
