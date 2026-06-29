import {
  clearAllVoiceClips,
  getVoiceClip,
  listVoiceClipIds,
  saveVoiceClip
} from "./storage";
import { invalidateVoiceCache } from "./playback";

export interface VoiceExportPack {
  version: 1;
  exportedAt: number;
  clips: Array<{ phraseId: string; mimeType: string; dataBase64: string }>;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

export async function buildVoiceExportPack(): Promise<VoiceExportPack> {
  const ids = await listVoiceClipIds();
  const clips = (
    await Promise.all(
      ids.map(async (phraseId) => {
        const clip = await getVoiceClip(phraseId);
        if (!clip) return null;
        return {
          phraseId,
          mimeType: clip.mimeType,
          dataBase64: await blobToBase64(clip.blob)
        };
      })
    )
  ).filter((c): c is VoiceExportPack["clips"][number] => c !== null);

  return {
    version: 1,
    exportedAt: Date.now(),
    clips
  };
}

export async function exportVoices(): Promise<void> {
  const pack = await buildVoiceExportPack();
  if (pack.clips.length === 0) {
    alert("No hay voces grabadas para exportar.");
    return;
  }

  const json = JSON.stringify(pack);
  const blob = new Blob([json], { type: "application/json" });
  const date = new Date().toISOString().slice(0, 10);
  const file = new File([blob], `tabata-voces-${date}.json`, {
    type: "application/json"
  });

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: "Mis voces",
        text: "Copia de seguridad de voces personalizadas"
      });
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function importVoices(file: File): Promise<number> {
  const text = await file.text();
  const pack = JSON.parse(text) as VoiceExportPack;
  if (pack.version !== 1 || !Array.isArray(pack.clips)) {
    throw new Error("Formato inválido");
  }

  let count = 0;
  for (const clip of pack.clips) {
    if (!clip.phraseId || !clip.dataBase64) continue;
    const blob = base64ToBlob(clip.dataBase64, clip.mimeType || "audio/mp4");
    await saveVoiceClip(clip.phraseId, blob);
    invalidateVoiceCache(clip.phraseId);
    count++;
  }
  return count;
}

export async function deleteAllVoices(): Promise<void> {
  await clearAllVoiceClips();
  invalidateVoiceCache();
}
