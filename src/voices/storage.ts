export interface VoiceClipRecord {
  phraseId: string;
  mimeType: string;
  blob: Blob;
  updatedAt: number;
}

/** What we actually persist. iOS Safari can fail to store a Blob directly in
 *  IndexedDB, so we keep the raw bytes as an ArrayBuffer instead. */
interface StoredVoiceClip {
  phraseId: string;
  mimeType: string;
  data?: ArrayBuffer;
  blob?: Blob; // legacy records recorded before the ArrayBuffer migration
  updatedAt: number;
}

function toRecord(stored: StoredVoiceClip): VoiceClipRecord {
  const blob =
    stored.blob ??
    new Blob([stored.data ?? new ArrayBuffer(0)], { type: stored.mimeType });
  return {
    phraseId: stored.phraseId,
    mimeType: stored.mimeType,
    blob,
    updatedAt: stored.updatedAt
  };
}

const DB_NAME = "interval-timer-voices";
const STORE = "clips";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveVoiceClip(
  phraseId: string,
  blob: Blob
): Promise<void> {
  const data = await blob.arrayBuffer();
  const db = await openDb();
  const record: StoredVoiceClip = {
    phraseId,
    mimeType: blob.type || "audio/mp4",
    data,
    updatedAt: Date.now()
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(record, phraseId);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function getVoiceClip(
  phraseId: string
): Promise<VoiceClipRecord | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(phraseId);
    req.onsuccess = () => {
      db.close();
      const stored = req.result as StoredVoiceClip | undefined;
      resolve(stored ? toRecord(stored) : null);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

export async function deleteVoiceClip(phraseId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(phraseId);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function listVoiceClipIds(): Promise<string[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAllKeys();
    req.onsuccess = () => {
      db.close();
      resolve((req.result as string[]) ?? []);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

export async function clearAllVoiceClips(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
