// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/config/env", () => ({ env: { NODE_ENV: "development" } }));

import { log } from "./log";

describe("log", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function lastEntry(spy: { mock: { calls: unknown[][] } }) {
    return JSON.parse(spy.mock.calls.at(-1)?.[0] as string) as Record<
      string,
      unknown
    >;
  }

  it("keeps the message, code and stack of an Error passed as fields", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = Object.assign(new Error("connection refused"), {
      code: "ECONNREFUSED",
    });

    log.warn("safe-fetch[listRegions] failed:", error);

    expect(lastEntry(warn)).toMatchObject({
      level: "warn",
      event: "safe-fetch[listRegions] failed:",
      message: "connection refused",
      code: "ECONNREFUSED",
      stack: expect.stringContaining("connection refused"),
    });
  });

  it("still spreads plain field objects", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    log.info("spot.created", { spotId: "abc" });

    expect(lastEntry(info)).toMatchObject({
      event: "spot.created",
      spotId: "abc",
    });
  });
});
