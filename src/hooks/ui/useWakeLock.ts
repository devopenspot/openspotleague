"use client";

import { useEffect } from "react";

/**
 * Keeps the screen on while `enabled`. The browser drops the lock whenever the
 * page is hidden, so it's requested again on return. Unsupported or refused
 * requests are ignored: the screen simply sleeps as usual.
 */
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof navigator === "undefined") return;
    if (!("wakeLock" in navigator)) return;

    let cancelled = false;
    let lock: WakeLockSentinel | null = null;

    async function acquire() {
      if (document.visibilityState !== "visible" || lock) return;
      try {
        const next = await navigator.wakeLock.request("screen");
        if (cancelled) {
          void next.release();
          return;
        }
        lock = next;
        lock.addEventListener("release", () => {
          lock = null;
        });
      } catch {
        // Denied, for example on low battery. Nothing the rider needs to act on.
      }
    }

    void acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", acquire);
      void lock?.release();
    };
  }, [enabled]);
}
