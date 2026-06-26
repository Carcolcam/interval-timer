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
  gain.gain.exponentialRampToValueAtTime(volume, when + 0.01);
  gain.gain.setValueAtTime(volume * 0.85, when + 0.08);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + decaySec);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(when);
  osc.stop(when + decaySec + 0.05);
}

/** Boxing bell — 2 s sustained ring. */
export function beepGo(): void {
  const c = ensureCtx();
  if (!c) return;
  const t = c.currentTime;
  const bellDur = 2.0;

  const partials = [
    { freq: 480, vol: 0.95 },
    { freq: 720, vol: 0.9 },
    { freq: 960, vol: 0.82 },
    { freq: 1440, vol: 0.68 },
    { freq: 1920, vol: 0.52 }
  ];
  for (const p of partials) {
    bellPartial(c, p.freq, p.vol, t, bellDur);
  }
  bellPartial(c, 560, 0.7, t + 0.1, bellDur);
  bellPartial(c, 840, 0.55, t + 0.1, bellDur * 0.9);
}

function makeBrownNoise(
  c: AudioContext,
  durationSec: number
): AudioBufferSourceNode {
  const samples = Math.floor(c.sampleRate * durationSec);
  const buffer = c.createBuffer(1, samples, c.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < samples; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5;
  }
  const src = c.createBufferSource();
  src.buffer = buffer;
  return src;
}

/** Nuclear shockwave — 3 s deep rumble + roar (no sharp grenade crack). */
function beepExplosion(): void {
  const c = ensureCtx();
  if (!c) return;
  const t = c.currentTime;
  const dur = 3.0;

  const rumble = c.createOscillator();
  rumble.type = "sine";
  rumble.frequency.setValueAtTime(55, t);
  rumble.frequency.exponentialRampToValueAtTime(18, t + dur);
  const rumbleGain = c.createGain();
  rumbleGain.gain.setValueAtTime(0.0001, t);
  rumbleGain.gain.exponentialRampToValueAtTime(1.0, t + 0.15);
  rumbleGain.gain.setValueAtTime(0.85, t + 0.8);
  rumbleGain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  const sub = c.createOscillator();
  sub.type = "triangle";
  sub.frequency.setValueAtTime(28, t);
  sub.frequency.exponentialRampToValueAtTime(12, t + dur * 0.9);
  const subGain = c.createGain();
  subGain.gain.setValueAtTime(0.0001, t);
  subGain.gain.exponentialRampToValueAtTime(0.9, t + 0.25);
  subGain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  const noise = makeBrownNoise(c, dur);
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(180, t);
  filter.frequency.exponentialRampToValueAtTime(60, t + dur);
  filter.Q.value = 0.7;
  const noiseGain = c.createGain();
  noiseGain.gain.setValueAtTime(0.0001, t);
  noiseGain.gain.exponentialRampToValueAtTime(0.95, t + 0.4);
  noiseGain.gain.setValueAtTime(0.75, t + 1.2);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  const roar = makeBrownNoise(c, dur);
  const roarFilter = c.createBiquadFilter();
  roarFilter.type = "bandpass";
  roarFilter.frequency.setValueAtTime(120, t + 0.2);
  roarFilter.frequency.exponentialRampToValueAtTime(40, t + dur);
  roarFilter.Q.value = 1.2;
  const roarGain = c.createGain();
  roarGain.gain.setValueAtTime(0.0001, t + 0.15);
  roarGain.gain.exponentialRampToValueAtTime(0.7, t + 0.6);
  roarGain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  rumble.connect(rumbleGain);
  rumbleGain.connect(c.destination);
  sub.connect(subGain);
  subGain.connect(c.destination);
  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(c.destination);
  roar.connect(roarFilter);
  roarFilter.connect(roarGain);
  roarGain.connect(c.destination);

  rumble.start(t);
  sub.start(t);
  noise.start(t);
  roar.start(t);
  rumble.stop(t + dur + 0.1);
  sub.stop(t + dur + 0.1);
  noise.stop(t + dur + 0.1);
  roar.stop(t + dur + 0.1);
}

/**
 * Countdown 5→1:
 * 5 medio · 4 alto · 3 muy alto · 2 largo máximo · 1 explosión nuclear 3 s
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
