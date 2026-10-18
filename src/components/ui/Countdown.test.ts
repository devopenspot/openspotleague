import { describe, expect, it } from "vitest";
import { formatCountdown, getCountdownParts } from "./Countdown";

describe("countdown", () => {
  const now = new Date("2026-08-10T12:00:00.000Z");

  it("splits a future timestamp into days and clock values", () => {
    const parts = getCountdownParts("2026-08-12T15:04:06.000Z", now);

    expect(parts).toEqual({
      totalSeconds: 183846,
      days: 2,
      hours: 3,
      minutes: 4,
      seconds: 6,
    });
    expect(formatCountdown(parts)).toBe("2d 03h 04m");
  });

  it("clamps expired and invalid timestamps to now", () => {
    expect(formatCountdown(getCountdownParts("2026-08-10T11:59:59.000Z", now))).toBe("Now");
    expect(formatCountdown(getCountdownParts("not-a-date", now))).toBe("Now");
  });

  it("uses a clock format for same-day deadlines", () => {
    expect(formatCountdown(getCountdownParts("2026-08-10T12:04:05.000Z", now))).toBe("00:04:05");
  });
});
