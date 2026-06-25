import { useEffect } from "react";
import { confirmKeepAwake, setKeepAwake } from "./keepAwake";

/** Keeps the screen on while `active` is true (entire player session). */
export function useKeepAwake(active: boolean): void {
  useEffect(() => {
    setKeepAwake(active);
    return () => setKeepAwake(false);
  }, [active]);
}

/** Re-confirm after a user gesture (required on iOS for video fallback). */
export { confirmKeepAwake };
