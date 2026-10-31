/** Pure playback rules for the rider study tools and Up next. */

export const TV_BACK_SECONDS = 5;
export const TV_LOOP_SECONDS = 5;
export const TV_UP_NEXT_SECONDS = 8;
/**
 * While a seek is in flight the player keeps reporting the old position. On
 * a phone that can outlast several time events, and re-seeking on each one
 * restarts the seek forever, so the video never moves again.
 */
export const TV_LOOP_SEEK_COOLDOWN_MS = 1000;

export const TV_PLAYBACK_RATES = [1, 0.5, 0.25] as const;
export type TvPlaybackRate = (typeof TV_PLAYBACK_RATES)[number];

export function nextPlaybackRate(rate: TvPlaybackRate): TvPlaybackRate {
  const index = TV_PLAYBACK_RATES.indexOf(rate);
  return TV_PLAYBACK_RATES[(index + 1) % TV_PLAYBACK_RATES.length] ?? 1;
}

export interface TvLoopRange {
  start: number;
  end: number;
}

/** The stretch a rider just saw: the last few seconds before `currentTime`. */
export function loopRange(currentTime: number): TvLoopRange {
  return {
    start: Math.max(0, currentTime - TV_LOOP_SECONDS),
    end: currentTime,
  };
}

/** Where to seek when the playhead passes the loop end, otherwise null. */
export function loopSeekTarget(
  range: TvLoopRange,
  currentTime: number,
  msSinceLastSeek: number,
): number | null {
  if (msSinceLastSeek < TV_LOOP_SEEK_COOLDOWN_MS) return null;
  return currentTime >= range.end ? range.start : null;
}

// YouTube: 100 = removed or private; 101, 150, 153 = embedding not allowed.
const UNPLAYABLE_ERROR_CODES: ReadonlySet<number> = new Set([100, 101, 150, 153]);

/**
 * A video can't play here only if YouTube says so and it hasn't been playing.
 * Other codes can fire and recover, so they must never skip a rider's video.
 */
export function isUnplayableError(code: number, hasPlayed: boolean): boolean {
  return UNPLAYABLE_ERROR_CODES.has(code) && !hasPlayed;
}

/** How far from the known end an "ended" signal can be and still be believed. */
const TV_ENDED_MARGIN_SECONDS = 5;

/** Unknown position or duration gets the benefit of the doubt. */
export function isRealEnd(currentTime?: number, duration?: number): boolean {
  if (currentTime === undefined || !duration) return true;
  return duration - currentTime <= TV_ENDED_MARGIN_SECONDS;
}

export function isUpNextWindow(currentTime: number, duration: number): boolean {
  if (duration <= 0) return false;
  const remaining = duration - currentTime;
  return remaining > 0 && remaining <= TV_UP_NEXT_SECONDS;
}
