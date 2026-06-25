import { useEffect, useRef } from "react";

type WakeLockSentinelLike = {
  release: () => Promise<void>;
  released: boolean;
};

/** Keeps the screen awake while `active` is true (where supported). */
export function useWakeLock(active: boolean): void {
  const lockRef = useRef<WakeLockSentinelLike | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function request() {
      try {
        const wl = (
          navigator as unknown as {
            wakeLock?: { request: (t: "screen") => Promise<WakeLockSentinelLike> };
          }
        ).wakeLock;
        if (!wl) return;
        const sentinel = await wl.request("screen");
        if (cancelled) {
          void sentinel.release();
          return;
        }
        lockRef.current = sentinel;
      } catch {
        /* ignore */
      }
    }

    function onVisibility() {
      if (document.visibilityState === "visible" && active) void request();
    }

    if (active) {
      void request();
      document.addEventListener("visibilitychange", onVisibility);
    }

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      if (lockRef.current && !lockRef.current.released) {
        void lockRef.current.release();
      }
      lockRef.current = null;
    };
  }, [active]);
}
