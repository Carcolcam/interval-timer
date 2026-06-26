/**
 * Audio cues via Web Audio API + speech + vibration.
 * Tuned for loud playback in group fitness / boxing classes (iOS Safari).
 */

let ctx: AudioContext | null = null;
let keepAlive: OscillatorNode | null = null;
let audioSessionSet = false;

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
  const osc = c.createOscillator();
  const gain = c.createGain();
  gain.gain.value = 0.0001;
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + 0.02);
}

function ensureCtx(): AudioContext | null {
  const c = getCtx();
  if (!c) return null;
  if (c.state === "suspended") void c.resume();
  return c;
}

function tone(
  freq: number,
  durationMs: number,
  when = 0,
  volume = 0.3,
  wave: OscillatorType = "sine",
  hold = false
): void {
  const c = ensureCtx();
  if (!c) return;
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

function bellPartial(
  c: AudioContext,
  freq: number,
  volume: number,
  when: number,
  decaySec: number
): void {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(volume, when + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + decaySec);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(when);
  osc.stop(when + decaySec + 0.05);
}

/** Loud boxing-ring bell when a new interval starts. */
export function beepGo(): void {
  const c = ensureCtx();
  if (!c) return;
  const t = c.currentTime;

  const partials = [
    { freq: 480, vol: 0.95, decay: 2.4 },
    { freq: 720, vol: 0.9, decay: 2.0 },
    { freq: 960, vol: 0.8, decay: 1.6 },
    { freq: 1440, vol: 0.65, decay: 1.2 },
    { freq: 1920, vol: 0.5, decay: 0.9 },
    { freq: 2400, vol: 0.35, decay: 0.6 }
  ];
  for (const p of partials) {
    bellPartial(c, p.freq, p.vol, t, p.decay);
  }
  // Double strike — classic ring bell feel
  bellPartial(c, 560, 0.75, t + 0.12, 1.8);
  bellPartial(c, 840, 0.6, t + 0.12, 1.4);
  bellPartial(c, 1120, 0.45, t + 0.12, 1.0);
}

/** Short burst + low boom for the final countdown second. */
function beepExplosion(): void {
  const c = ensureCtx();
  if (!c) return;
  const t = c.currentTime;
  const dur = 0.75;
  const samples = Math.floor(c.sampleRate * dur);
  const buffer = c.createBuffer(1, samples, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < samples; i++) {
    const env = Math.exp(-i / (c.sampleRate * 0.12));
    data[i] = (Math.random() * 2 - 1) * env;
  }
  const noise = c.createBufferSource();
  noise.buffer = buffer;
  const noiseGain = c.createGain();
  noiseGain.gain.setValueAtTime(0.0001, t);
  noiseGain.gain.exponentialRampToValueAtTime(1.0, t + 0.008);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);

  const boom = c.createOscillator();
  boom.type = "sine";
  boom.frequency.setValueAtTime(90, t);
  boom.frequency.exponentialRampToValueAtTime(35, t + 0.35);
  const boomGain = c.createGain();
  boomGain.gain.setValueAtTime(0.0001, t);
  boomGain.gain.exponentialRampToValueAtTime(1.0, t + 0.01);
  boomGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);

  const crack = c.createOscillator();
  crack.type = "square";
  crack.frequency.value = 2200;
  const crackGain = c.createGain();
  crackGain.gain.setValueAtTime(0.0001, t);
  crackGain.gain.exponentialRampToValueAtTime(0.85, t + 0.005);
  crackGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);

  noise.connect(noiseGain);
  noiseGain.connect(c.destination);
  boom.connect(boomGain);
  boomGain.connect(c.destination);
  crack.connect(crackGain);
  crackGain.connect(c.destination);
  noise.start(t);
  boom.start(t);
  crack.start(t);
  noise.stop(t + dur);
  boom.stop(t + 0.5);
  crack.stop(t + 0.25);
}

/**
 * Countdown 5→1 before interval change:
 * 5 medio · 4 alto · 3 muy alto · 2 largo máximo · 1 explosión
 */
export function beepCountdown(secondsRemaining: number): void {
  if (secondsRemaining === 1) {
    beepExplosion();
    return;
  }

  const profiles: Record<
    number,
    { durationMs: number; volume: number; freq: number; wave: OscillatorType }
  > = {
    5: { durationMs: 130, volume: 0.55, freq: 880, wave: "square" },
    4: { durationMs: 130, volume: 0.72, freq: 1000, wave: "square" },
    3: { durationMs: 130, volume: 0.88, freq: 1150, wave: "square" },
    2: { durationMs: 2000, volume: 1.0, freq: 1300, wave: "square" }
  };

  const p = profiles[secondsRemaining];
  if (!p) return;
  tone(p.freq, p.durationMs, 0, p.volume, p.wave, secondsRemaining === 2);
}

/** Final cue when the workout ends. */
export function beepFinish(): void {
  beepGo();
  tone(660, 300, 0.5, 0.5, "square");
  tone(880, 400, 0.9, 0.6, "square");
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
