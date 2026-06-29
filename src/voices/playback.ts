import {
  decodeVoiceClip,
  duckOthers,
  endDuck,
  invalidateVoiceBuffer,
  playVoiceBuffer,
  speak
} from "../audio";
import { getVoiceClip } from "./storage";

type Playable = { buffer: AudioBuffer } | { url: string };

const playableCache = new Map<string, Playable>();
const knownMissing = new Set<string>();

async function getPlayable(phraseId: string): Promise<Playable | null> {
  const cached = playableCache.get(phraseId);
  // Only a decoded buffer (low latency) is worth keeping; if we previously fell
  // back to an HTMLAudio URL (because audio wasn't unlocked yet), try to upgrade
  // it to a buffer now so cues stay tightly in sync.
  if (cached && "buffer" in cached) return cached;
  if (knownMissing.has(phraseId)) return null;

  const clip = await getVoiceClip(phraseId);
  if (!clip) {
    knownMissing.add(phraseId);
    return null;
  }

  const buffer = await decodeVoiceClip(phraseId, clip.blob);
  if (buffer) {
    if (cached && "url" in cached) URL.revokeObjectURL(cached.url);
    const playable: Playable = { buffer };
    playableCache.set(phraseId, playable);
    return playable;
  }

  // No audio context yet: reuse the cached URL or make one, but don't treat it
  // as final so a later call upgrades to a buffer.
  if (cached) return cached;
  const playable: Playable = { url: URL.createObjectURL(clip.blob) };
  playableCache.set(phraseId, playable);
  return playable;
}

/** Fallback path when Web Audio can't decode the recording. */
function playUrl(url: string, duck: boolean): Promise<void> {
  return new Promise((resolve) => {
    const audio = new Audio(url);
    audio.volume = 1;
    if (duck) duckOthers();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      if (duck) endDuck();
      resolve();
    };
    audio.onended = finish;
    audio.onerror = finish;
    void audio.play().catch(finish);
  });
}

function playPlayable(p: Playable, duck: boolean): Promise<void> {
  return "buffer" in p ? playVoiceBuffer(p.buffer, duck) : playUrl(p.url, duck);
}

export function invalidateVoiceCache(phraseId?: string): void {
  const revoke = (p?: Playable) => {
    if (p && "url" in p) URL.revokeObjectURL(p.url);
  };
  if (phraseId) {
    revoke(playableCache.get(phraseId));
    playableCache.delete(phraseId);
    knownMissing.delete(phraseId);
    invalidateVoiceBuffer(phraseId);
  } else {
    for (const p of playableCache.values()) revoke(p);
    playableCache.clear();
    knownMissing.clear();
    invalidateVoiceBuffer();
  }
}

export async function hasVoiceClip(phraseId: string): Promise<boolean> {
  const clip = await getVoiceClip(phraseId);
  return clip !== null;
}

/** Decode/prepare clips ahead of time so the first cue has no lag. */
export async function preloadVoiceClips(phraseIds: string[]): Promise<void> {
  await Promise.all(phraseIds.map((id) => getPlayable(id)));
}

/**
 * Play a custom recording if available, otherwise speak fallback text.
 * Empty fallback = custom-only (no TTS). `duck` lowers background music.
 */
export function sayPhrase(
  phraseId: string,
  fallbackText: string,
  enabled: boolean,
  useCustom = true,
  duck = true
): void {
  if (!enabled) return;
  void (async () => {
    if (useCustom) {
      const playable = await getPlayable(phraseId);
      if (playable) {
        await playPlayable(playable, duck);
        return;
      }
    }
    if (fallbackText) speak(fallbackText, true);
  })();
}

/** Preview a clip in the voices screen (no ducking). */
export async function previewPhrase(phraseId: string): Promise<boolean> {
  const playable = await getPlayable(phraseId);
  if (!playable) return false;
  await playPlayable(playable, false);
  return true;
}
