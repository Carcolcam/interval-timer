/**
 * Lightweight audio cues using the Web Audio API plus optional
 * speech synthesis and vibration. Designed for iOS Safari where audio
 * must be unlocked by a user gesture.
 */

let ctx: AudioContext | null = null;
let keepAlive: OscillatorNode | null = null;
let audioSessionSet = false;

/**
 * On iOS the physical mute switch silences Web Audio unless the page declares
 * a "playback" audio session. Supported on iOS 16.4+ (iPhone 14 Pro Max).
 */
function configureAudioSession(): void {
  if (audioSessionSet) return;
  const session = (
    navigator as unknown as { audioSession?: { type?: string } }
  ).audioSession;
  if (session) {
    try {
      session.type = "playback";
      audioSessionSet = true;
    } catch {
      /* ignore */
    }
  }
}

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

/**
 * Keeps a silent oscillator running so iOS does not tear down the audio
 * route between beeps (which can cause the first beep after a gap to be lost).
 */
function startKeepAlive(c: AudioContext): void {
  if (keepAlive) return;
  try {
    const osc = c.createOscillator();
    const gain = c.createGain();
    gain.gain.value = 0.0001;
    osc.frequency.value = 30;
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start();
    keepAlive = osc;
  } catch {
    /* ignore */
  }
}

/** Must be called from a user gesture (tap) to unlock audio on iOS. */
export function unlockAudio(): void {
  configureAudioSession();
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") void c.resume();
  startKeepAlive(c);
  // Play a near-silent blip to fully unlock on iOS.
  const osc = c.createOscillator();
  const gain = c.createGain();
  gain.gain.value = 0.0001;
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + 0.02);
}

function tone(
  freq: number,
  durationMs: number,
  when = 0,
  volume = 0.3,
  wave: OscillatorType = "sine",
  hold = false
): void {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") void c.resume();
  const start = c.currentTime + when;
  const end = start + durationMs / 1000;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = wave;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
  if (hold && durationMs > 80) {
    gain.gain.setValueAtTime(volume, end - 0.06);
  }
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(start);
  osc.stop(end + 0.02);
}

/** Countdown beeps from 5→1: volume rises; last two last 2 s and are loudest. */
export function beepCountdown(secondsRemaining: number): void {
  const profiles: Record<
    number,
    { durationMs: number; volume: number; freq: number; wave: OscillatorType }
  > = {
    5: { durationMs: 130, volume: 0.45, freq: 880, wave: "square" },
    4: { durationMs: 150, volume: 0.58, freq: 940, wave: "square" },
    3: { durationMs: 170, volume: 0.72, freq: 1020, wave: "square" },
    2: { durationMs: 2000, volume: 0.92, freq: 1180, wave: "square" },
    1: { durationMs: 2000, volume: 1.0, freq: 1400, wave: "square" }
  };
  const p = profiles[secondsRemaining];
  if (!p) return;
  tone(p.freq, p.durationMs, 0, p.volume, p.wave, secondsRemaining <= 2);
}

/** Longer, higher tone when a new interval starts. */
export function beepGo(): void {
  tone(1320, 350, 0, 0.35);
}

/** Final tone when the workout ends. */
export function beepFinish(): void {
  tone(660, 200, 0, 0.3);
  tone(880, 200, 0.18, 0.3);
  tone(1320, 450, 0.36, 0.35);
}

export function vibrate(pattern: number | number[]): void {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* ignore */
    }
  }
}

export function speak(text: string, enabled: boolean): void {
  if (!enabled) return;
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "es-ES";
    u.rate = 1;
    u.pitch = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}
