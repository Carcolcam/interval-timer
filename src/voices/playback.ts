import { speak } from "../audio";
import { getVoiceClip } from "./storage";

const urlCache = new Map<string, string>();

async function getClipUrl(phraseId: string): Promise<string | null> {
  const cached = urlCache.get(phraseId);
  if (cached) return cached;
  const clip = await getVoiceClip(phraseId);
  if (!clip) return null;
  const url = URL.createObjectURL(clip.blob);
  urlCache.set(phraseId, url);
  return url;
}

export function invalidateVoiceCache(phraseId?: string): void {
  if (phraseId) {
    const url = urlCache.get(phraseId);
    if (url) URL.revokeObjectURL(url);
    urlCache.delete(phraseId);
  } else {
    for (const url of urlCache.values()) URL.revokeObjectURL(url);
    urlCache.clear();
  }
}

export async function hasVoiceClip(phraseId: string): Promise<boolean> {
  if (urlCache.has(phraseId)) return true;
  const clip = await getVoiceClip(phraseId);
  return clip !== null;
}

export async function preloadVoiceClips(phraseIds: string[]): Promise<void> {
  await Promise.all(phraseIds.map((id) => getClipUrl(id)));
}

function playAudioUrl(url: string): Promise<void> {
  return new Promise((resolve) => {
    const audio = new Audio(url);
    audio.onended = () => resolve();
    audio.onerror = () => resolve();
    void audio.play().catch(() => resolve());
  });
}

/**
 * Play a custom recording if available, otherwise speak fallback text.
 * Empty fallback = custom-only (no TTS).
 */
export function sayPhrase(
  phraseId: string,
  fallbackText: string,
  enabled: boolean,
  useCustom = true
): void {
  if (!enabled) return;
  void (async () => {
    if (useCustom) {
      const url = await getClipUrl(phraseId);
      if (url) {
        await playAudioUrl(url);
        return;
      }
    }
    if (fallbackText) speak(fallbackText, true);
  })();
}

/** Preview a clip in the voices screen (ignores TTS). */
export async function previewPhrase(phraseId: string): Promise<boolean> {
  const url = await getClipUrl(phraseId);
  if (!url) return false;
  await playAudioUrl(url);
  return true;
}
