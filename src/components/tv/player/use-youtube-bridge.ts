"use client";

import { useCallback, useEffect, useRef } from "react";

// Guard against YouTube double-firing "ended" on seek/replay
const ENDED_DEBOUNCE_MS = 1000;

const STATE_ENDED = 0;
const STATE_PLAYING = 1;
const STATE_PAUSED = 2;

export interface YoutubeUpdate {
  event: string;
  state?: number;
  muted?: boolean;
  currentTime?: number;
  duration?: number;
  errorCode?: number;
}

/**
 * Reads one iframe API message. `duration` first arrives on
 * `initialDelivery`; `currentTime` comes on `infoDelivery` about 4x/second.
 */
export function readYoutubeMessage(raw: unknown): YoutubeUpdate | null {
  if (typeof raw !== "string" || !raw.includes('"event"')) return null;
  let data: { event?: unknown; info?: unknown };
  try {
    data = JSON.parse(raw) as typeof data;
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  if (typeof data.event !== "string") return null;

  const { event, info } = data;
  if (event === "onError") {
    return typeof info === "number" ? { event, errorCode: info } : { event };
  }
  // Other events also send bare numbers (a rate, a time), and a 0 from one of
  // those must not read as "ended".
  if (typeof info === "number") {
    return event === "onStateChange" ? { event, state: info } : { event };
  }
  if (typeof info !== "object" || info === null) return { event };

  const fields = info as Record<string, unknown>;
  const update: YoutubeUpdate = { event };
  if (typeof fields.playerState === "number") update.state = fields.playerState;
  if (typeof fields.muted === "boolean") update.muted = fields.muted;
  if (typeof fields.currentTime === "number") {
    update.currentTime = fields.currentTime;
  }
  if (typeof fields.duration === "number" && fields.duration > 0) {
    update.duration = fields.duration;
  }
  return update;
}

export function postYoutubeCommand(
  iframe: HTMLIFrameElement | null,
  func: string,
  args: unknown[] = [],
) {
  try {
    iframe?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func, args }),
      "*",
    );
  } catch {
    // cross-origin security guard
  }
}

/** Handshake that makes the iframe API start dispatching player events. */
export function postYoutubeListening(iframe: HTMLIFrameElement | null) {
  try {
    iframe?.contentWindow?.postMessage(
      JSON.stringify({ event: "listening" }),
      "*",
    );
  } catch {
    // cross-origin security guard
  }
}

export function useYoutubeBridge({
  enabled,
  initialPlaying,
  onReady,
  onEnded,
  onError,
  onTime,
  onMuted,
}: {
  enabled: boolean;
  initialPlaying: boolean;
  onReady: () => void;
  onEnded: () => void;
  onError: (code: number) => void;
  onTime: (currentTime: number, duration: number) => void;
  onMuted: (muted: boolean) => void;
}) {
  const isPlayingRef = useRef(initialPlaying);
  const durationRef = useRef(0);
  const lastEndedAtRef = useRef(0);

  const resetTiming = useCallback(() => {
    durationRef.current = 0;
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const handler = (event: MessageEvent) => {
      // Restrict to YouTube origins to avoid processing every postMessage in the app
      if (
        event.origin &&
        !event.origin.includes("youtube") &&
        !event.origin.includes("youtu.be")
      )
        return;
      const update = readYoutubeMessage(event.data);
      if (!update) return;

      if (update.event === "onReady" || update.event === "initialDelivery") {
        onReady();
      }
      if (update.errorCode !== undefined) {
        onError(update.errorCode);
        return;
      }
      if (update.state === STATE_PLAYING) isPlayingRef.current = true;
      else if (update.state === STATE_PAUSED) isPlayingRef.current = false;
      if (update.muted !== undefined) onMuted(update.muted);
      if (update.duration !== undefined) durationRef.current = update.duration;
      if (update.currentTime !== undefined) {
        onTime(update.currentTime, durationRef.current);
      }
      if (update.state === STATE_ENDED) {
        const now = Date.now();
        if (now - lastEndedAtRef.current < ENDED_DEBOUNCE_MS) return;
        lastEndedAtRef.current = now;
        onEnded();
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [enabled, onReady, onEnded, onError, onTime, onMuted]);

  return { isPlayingRef, resetTiming };
}
