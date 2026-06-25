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

function tone(freq: number, durationMs: number, when = 0, volume = 0.3): void {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") void c.resume();
  const start = c.currentTime + when;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + durationMs / 1000);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(start);
  osc.stop(start + durationMs / 1000 + 0.02);
}

/** Short tick for the final countdown seconds (3-2-1). */
export function beepCountdown(): void {
  tone(880, 140, 0, 0.25);
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
