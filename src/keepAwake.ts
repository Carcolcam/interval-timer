/**
 * Keeps the screen on during workouts.
 * Uses the Screen Wake Lock API when available, plus a silent looping video
 * fallback that works on iOS Safari / installed PWAs.
 */

type WakeLockSentinel = {
  release: () => Promise<void>;
  released: boolean;
  addEventListener?: (type: "release", listener: () => void) => void;
};

// Minimal silent MP4 (NoSleep-style) — keeps iOS from auto-locking.
const SILENT_MP4 =
  "data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAs1tZGF0AAACrgYF//+q3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE1MiByMjg1NCBlOWE1OTYgLSBILjI2NC9NUEVHLUFWQyBjb2RlYyAtIENvcHlsZWZ0IDIwMDMtMjAxNyAtIGh0dHA6Ly93d3cudmlkZW9sYW4ub3JnL3gyNjQuaHRtbCAtIG9wdGlvbnM6IGNhYmFjPTEgcmVmPTMgZGVibG9jaz0xOjA6MCBhbmFseXNlPTB4MzoweDExMyBtZT1oZXggc3ViPTcgcHN5PTEgcHN5X3JkPTEuMDA6MC4wMCBtaXhlZF9yZWY9MSBtZV9yYW5nZT0xNiBjaHJvbWFfbWU9MSB0cmVsbGlzPTEgOHg4ZGN0PTAgY3FtPTAgZGVhZHpvbmU9MjEsMTEgZmFzdF9wc2tpcD0xIGNocm9tYV9xcF9vZmZzZXQ9LTIgdGhyZWFkcz0xIGxvb2thaGVhZF90aHJlYWRzPTEgc2xpY2VkX3RocmVhZHM9MCBucj0wIGRlY2ltYXRlPTEgaW50ZXJsYWNlZD0wIGJsdXJheV9jb21wYXQ9MCBjb25zdHJhaW5lZF9pbnRyYT0wIGJmcmFtZXM9MCB3ZWlnaHRwPTAga2V5aW50PTIwc2l6ZT00MCB4Yl9yYW5nZT1yZWQgZXh0cmFjb3BzPTEgY3FfbWU9MCBjdWJpYz0wIGluc2VydGlvbl9zZWFyY2g9MCBwZWNfY2hyX29tZj0wIHBleF92ZXJ0PTEgc29tZXRpbWU9MCBwaGVfbWVfYXNlX2xvY29rXzE9MCBvY2N1cl9saXR0ZXJfcmF0ZT00MCBwYWxldHRlX2xhdD0wIGZpbHRlcl9zcGFyc2U9MCBjb21wYW5kPTEwMDA6MTAgdGVtcG9yYWw9NTAgc3VicmF0ZT00IG1lX2NoYW5jZWxfc2V0PTEgaXJhbmdlXzY0MzIz";

let wantAwake = false;
let wakeLock: WakeLockSentinel | null = null;
let video: HTMLVideoElement | null = null;

function getVideo(): HTMLVideoElement {
  if (video) return video;
  const el = document.createElement("video");
  el.setAttribute("playsinline", "");
  el.setAttribute("webkit-playsinline", "");
  el.muted = true;
  el.loop = true;
  el.src = SILENT_MP4;
  el.style.cssText =
    "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;";
  document.body.appendChild(el);
  video = el;
  return el;
}

async function requestWakeLock(): Promise<void> {
  const api = (
    navigator as unknown as {
      wakeLock?: { request: (t: "screen") => Promise<WakeLockSentinel> };
    }
  ).wakeLock;
  if (!api || !wantAwake) return;

  try {
    if (wakeLock && !wakeLock.released) return;
    wakeLock = await api.request("screen");
    wakeLock.addEventListener?.("release", () => {
      if (wantAwake && document.visibilityState === "visible") {
        void requestWakeLock();
      }
    });
  } catch {
    /* Wake Lock denied or unsupported — video fallback handles iOS */
  }
}

async function startVideoFallback(): Promise<void> {
  if (!wantAwake) return;
  const el = getVideo();
  try {
    await el.play();
  } catch {
    /* Needs a user gesture first — enableKeepAwake() is called from Play */
  }
}

function stopVideoFallback(): void {
  if (!video) return;
  video.pause();
  try {
    video.currentTime = 0;
  } catch {
    /* ignore */
  }
}

async function releaseWakeLock(): Promise<void> {
  if (wakeLock && !wakeLock.released) {
    try {
      await wakeLock.release();
    } catch {
      /* ignore */
    }
  }
  wakeLock = null;
}

async function apply(): Promise<void> {
  if (!wantAwake) return;
  await requestWakeLock();
  await startVideoFallback();
}

function onVisibility(): void {
  if (document.visibilityState === "visible" && wantAwake) void apply();
}

function onPageShow(): void {
  if (wantAwake) void apply();
}

let listenersBound = false;

function bindListeners(): void {
  if (listenersBound) return;
  listenersBound = true;
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pageshow", onPageShow);
}

function unbindListeners(): void {
  if (!listenersBound) return;
  listenersBound = false;
  document.removeEventListener("visibilitychange", onVisibility);
  window.removeEventListener("pageshow", onPageShow);
}

/** Turn on screen-awake (call from Player mount). */
export function setKeepAwake(enabled: boolean): void {
  wantAwake = enabled;
  if (enabled) {
    bindListeners();
    void apply();
  } else {
    unbindListeners();
    stopVideoFallback();
    void releaseWakeLock();
  }
}

/**
 * Call from a user tap (Play) so iOS allows the silent video to start.
 */
export function confirmKeepAwake(): void {
  if (!wantAwake) return;
  void apply();
}
