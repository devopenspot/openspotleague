import { describe, expect, it } from "vitest";
import {
  isRealEnd,
  isUnplayableError,
  isUpNextWindow,
  loopRange,
  loopSeekTarget,
  nextPlaybackRate,
} from "./tv-study";

describe("nextPlaybackRate", () => {
  it("cycles through slow motion and back to normal", () => {
    expect(nextPlaybackRate(1)).toBe(0.5);
    expect(nextPlaybackRate(0.5)).toBe(0.25);
    expect(nextPlaybackRate(0.25)).toBe(1);
  });
});

describe("loopRange", () => {
  it("covers the seconds just watched", () => {
    expect(loopRange(42)).toEqual({ start: 37, end: 42 });
  });

  it("never starts before the video", () => {
    expect(loopRange(2)).toEqual({ start: 0, end: 2 });
  });
});

describe("loopSeekTarget", () => {
  const range = { start: 37, end: 42 };

  it("waits while the playhead is inside the loop", () => {
    expect(loopSeekTarget(range, 40, 5000)).toBeNull();
  });

  it("jumps back once the playhead reaches the end", () => {
    expect(loopSeekTarget(range, 42, 5000)).toBe(37);
    expect(loopSeekTarget(range, 42.3, 5000)).toBe(37);
  });

  it("does not seek again while the last seek is still in flight", () => {
    expect(loopSeekTarget(range, 42.3, 250)).toBeNull();
    expect(loopSeekTarget(range, 42.3, 1000)).toBe(37);
  });
});

describe("isUnplayableError", () => {
  it("accepts removed and embed-blocked videos that never played", () => {
    expect(isUnplayableError(100, false)).toBe(true);
    expect(isUnplayableError(101, false)).toBe(true);
    expect(isUnplayableError(150, false)).toBe(true);
    expect(isUnplayableError(153, false)).toBe(true);
  });

  it("ignores recoverable codes", () => {
    expect(isUnplayableError(2, false)).toBe(false);
    expect(isUnplayableError(5, false)).toBe(false);
  });

  it("ignores any error once the video has been playing", () => {
    expect(isUnplayableError(150, true)).toBe(false);
  });
});

describe("isRealEnd", () => {
  it("believes an end signal near the end of the video", () => {
    expect(isRealEnd(98, 100)).toBe(true);
  });

  it("rejects an end signal far from the end", () => {
    expect(isRealEnd(5, 3897)).toBe(false);
  });

  it("believes it when position or duration is unknown", () => {
    expect(isRealEnd(undefined, 100)).toBe(true);
    expect(isRealEnd(5, 0)).toBe(true);
  });
});

describe("isUpNextWindow", () => {
  it("opens in the last seconds of a video", () => {
    expect(isUpNextWindow(92, 100)).toBe(true);
    expect(isUpNextWindow(91, 100)).toBe(false);
  });

  it("stays closed when the video has ended or duration is unknown", () => {
    expect(isUpNextWindow(100, 100)).toBe(false);
    expect(isUpNextWindow(5, 0)).toBe(false);
  });
});
