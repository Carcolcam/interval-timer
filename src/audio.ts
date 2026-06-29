/**
 * Audio cues via Web Audio API + speech + vibration.
 * Tuned for loud playback in group fitness / boxing classes (iOS Safari).
 */

let ctx: AudioContext | null = null;
let keepAlive: OscillatorNode | null = null;
let masterGain: GainNode | null = null;
let mixWithMusic = true;

/** Route audio to speakers. ambient = mixes with Spotify/Apple Music. */
export function setAudioMixWithMusic(mix: boolean): void {
  mixWithMusic = mix;
  const session = (
    navigator as unknown as { audioSession?: { type?: string } }
  ).audioSession;
  if (session) {
    try {
      session.type = mix ? "ambient" : "playback";
    } catch {
      /* ignore */
    }
  }
  const c = getCtx();
  if (c && masterGain) {
    masterGain.gain.value = mix ? 1.35 : 1.0;
  }
}

function getOutput(c: AudioContext): AudioNode {
  if (!masterGain) {
    masterGain = c.createGain();
    masterGain.gain.value = mixWithMusic ? 1.35 : 1.0;
    masterGain.connect(c.destination);
  }
  return masterGain;
}

function configureAudioSession(): void {
  setAudioMixWithMusic(mixWithMusic);
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
    gain.connect(getOutput(c));
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

/**
 * Resume audio after an interruption (incoming call, Siri, control center).
 * iOS suspends the AudioContext during a call; we wake it back up on return.
 */
export function resumeAudioAfterInterruption(): void {
  const c = ctx;
  if (!c) return;
  if (c.state === "suspended") {
    void c.resume().then(() => startKeepAlive(c));
  }
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") resumeAudioAfterInterruption();
  });
  window.addEventListener("focus", resumeAudioAfterInterruption);
  window.addEventListener("pageshow", resumeAudioAfterInterruption);
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
  gain.connect(getOutput(c));
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
  gain.connect(getOutput(c));
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
  rumbleGain.connect(getOutput(c));
  sub.connect(subGain);
  subGain.connect(getOutput(c));
  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(getOutput(c));
  roar.connect(roarFilter);
  roarFilter.connect(roarGain);
  roarGain.connect(getOutput(c));

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
 * Countdown 5→1.
 * Work: 5 medio · 4 alto · 3 muy alto · 2 largo máximo · 1 explosión nuclear.
 * Other phases: escalating short beeps only.
 */
export function beepCountdown(
  secondsRemaining: number,
  isWork = false
): void {
  if (isWork) {
    if (secondsRemaining === 1) {
      beepExplosion();
      return;
    }

    const workProfiles: Record<
      number,
      { durationMs: number; volume: number; freq: number; wave: OscillatorType }
    > = {
      5: { durationMs: 130, volume: 0.55, freq: 880, wave: "square" },
      4: { durationMs: 130, volume: 0.72, freq: 1000, wave: "square" },
      3: { durationMs: 130, volume: 0.88, freq: 1150, wave: "square" },
      2: { durationMs: 2000, volume: 1.0, freq: 1300, wave: "square" }
    };

    const p = workProfiles[secondsRemaining];
    if (!p) return;
    tone(p.freq, p.durationMs, 0, p.volume, p.wave, secondsRemaining === 2);
    return;
  }

  const simpleProfiles: Record<
    number,
    { durationMs: number; volume: number; freq: number }
  > = {
    5: { durationMs: 130, volume: 0.55, freq: 880 },
    4: { durationMs: 130, volume: 0.72, freq: 1000 },
    3: { durationMs: 130, volume: 0.88, freq: 1150 },
    2: { durationMs: 130, volume: 0.95, freq: 1300 },
    1: { durationMs: 130, volume: 1.0, freq: 1400 }
  };

  const p = simpleProfiles[secondsRemaining];
  if (!p) return;
  tone(p.freq, p.durationMs, 0, p.volume, "square");
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

let preferredVoice: SpeechSynthesisVoice | null = null;

/** Picks the most natural Spanish voice available on the device. */
function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return null;
  }
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return preferredVoice;

  const spanish = voices.filter((v) =>
    (v.lang || "").toLowerCase().startsWith("es")
  );
  const pool = spanish.length ? spanish : voices;

  const score = (v: SpeechSynthesisVoice): number => {
    const name = `${v.name} ${v.voiceURI}`.toLowerCase();
    let s = 0;
    // Higher-quality / neural voices on iOS & Android
    if (/(enhanced|premium|neural|natural|siri)/.test(name)) s += 12;
    // Known good Spanish voices
    if (/(m[oó]nica|paulina|marisol|luc[ií]a|elena|sof[ií]a|jorge)/.test(name)) {
      s += 5;
    }
    if ((v.lang || "").toLowerCase() === "es-es") s += 3;
    if ((v.lang || "").toLowerCase() === "es-mx") s += 2;
    if (v.localService) s += 1;
    return s;
  };

  preferredVoice =
    [...pool].sort((a, b) => score(b) - score(a))[0] ?? null;
  return preferredVoice;
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  pickVoice();
  window.speechSynthesis.onvoiceschanged = () => pickVoice();
}

let speechUnlocked = false;

/**
 * iOS blocks speechSynthesis until it's first triggered from a user gesture.
 * Call this from a tap (e.g. Play) so the spoken countdown works later, even
 * when phase announcements are disabled ("only countdown" mode).
 */
export function unlockSpeech(): void {
  if (speechUnlocked) return;
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    const voice = preferredVoice ?? pickVoice();
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    } else {
      u.lang = "es-ES";
    }
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    speechUnlocked = true;
  } catch {
    /* ignore */
  }
}

export function speak(text: string, enabled: boolean): void {
  if (!enabled) return;
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    const voice = preferredVoice ?? pickVoice();
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    } else {
      u.lang = "es-ES";
    }
    // Slightly brighter and energetic for a more motivating delivery.
    u.rate = 1.05;
    u.pitch = 1.12;
    u.volume = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

// ---- Ducking background music (mimics native TTS behaviour) ----

function getAudioSessionObj(): { type?: string } | null {
  const s = (navigator as unknown as { audioSession?: { type?: string } })
    .audioSession;
  return s ?? null;
}

/** Switch to a recording-capable session so getUserMedia isn't blocked. */
export function setRecordingSession(): void {
  const s = getAudioSessionObj();
  if (!s) return;
  try {
    s.type = "play-and-record";
  } catch {
    /* ignore */
  }
}

/** Restore the user's playback session (ambient/playback) after recording. */
export function restoreAudioSession(): void {
  configureAudioSession();
}

let duckRefCount = 0;
let unduckTimer: number | null = null;

/**
 * Lower the volume of other apps' audio (Spotify/Apple Music) while a custom
 * voice clip plays — the same effect iOS gives to speechSynthesis. Reference
 * counted so consecutive countdown cues stay ducked without bouncing.
 */
export function duckOthers(): void {
  const s = getAudioSessionObj();
  if (!s) return;
  duckRefCount++;
  if (unduckTimer != null) {
    clearTimeout(unduckTimer);
    unduckTimer = null;
  }
  try {
    s.type = "transient";
  } catch {
    /* ignore */
  }
}

/** Restore the previous session shortly after the clip ends. */
export function endDuck(): void {
  const s = getAudioSessionObj();
  if (!s) return;
  duckRefCount = Math.max(0, duckRefCount - 1);
  if (duckRefCount > 0) return;
  if (unduckTimer != null) clearTimeout(unduckTimer);
  unduckTimer = window.setTimeout(() => {
    try {
      s.type = mixWithMusic ? "ambient" : "playback";
    } catch {
      /* ignore */
    }
    unduckTimer = null;
  }, 700);
}

// ---- Custom voice clip playback through the (boosted) Web Audio graph ----

const VOICE_GAIN = 1.6;
const voiceBufferCache = new Map<string, AudioBuffer>();

/** Decode a recorded clip into a cached AudioBuffer for low-latency playback. */
export async function decodeVoiceClip(
  key: string,
  blob: Blob
): Promise<AudioBuffer | null> {
  const cached = voiceBufferCache.get(key);
  if (cached) return cached;
  const c = ensureCtx();
  if (!c) return null;
  try {
    const arr = await blob.arrayBuffer();
    const buffer = await new Promise<AudioBuffer>((resolve, reject) => {
      // Callback form for broadest Safari compatibility.
      c.decodeAudioData(arr.slice(0), resolve, reject);
    });
    voiceBufferCache.set(key, buffer);
    return buffer;
  } catch {
    return null;
  }
}

export function invalidateVoiceBuffer(key?: string): void {
  if (key) voiceBufferCache.delete(key);
  else voiceBufferCache.clear();
}

/** Play a decoded clip loudly, optionally ducking background music. */
export function playVoiceBuffer(buffer: AudioBuffer, duck: boolean): Promise<void> {
  return new Promise((resolve) => {
    const c = ensureCtx();
    if (!c) {
      resolve();
      return;
    }
    if (c.state === "suspended") void c.resume();
    if (duck) duckOthers();
    const src = c.createBufferSource();
    src.buffer = buffer;
    const gain = c.createGain();
    gain.gain.value = VOICE_GAIN;
    src.connect(gain);
    gain.connect(getOutput(c));
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      if (duck) endDuck();
      resolve();
    };
    src.onended = finish;
    try {
      src.start();
    } catch {
      finish();
      return;
    }
    // Safety net if onended never fires.
    window.setTimeout(finish, buffer.duration * 1000 + 500);
  });
}
