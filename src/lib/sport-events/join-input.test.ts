import { describe, expect, it } from "vitest";
import { resolveEventJoinPath } from "@/lib/sport-events/join-input";

describe("resolveEventJoinPath", () => {
  it("routes a bare invite code, keeping its case", () => {
    expect(resolveEventJoinPath("  abcDEF123456  ")).toBe(
      "/sport-events/join/abcDEF123456",
    );
  });

  it("rejects empty input", () => {
    expect(resolveEventJoinPath("   ")).toBeNull();
  });

  it("accepts a full invite link", () => {
    expect(
      resolveEventJoinPath(
        "https://openspotleague.com/sport-events/join/abcDEF123456?utm=1",
      ),
    ).toBe("/sport-events/join/abcDEF123456");
  });

  it("accepts a relative invite link", () => {
    expect(resolveEventJoinPath("/sport-events/join/abcDEF123456#top")).toBe(
      "/sport-events/join/abcDEF123456",
    );
  });

  it("never follows a link anywhere else", () => {
    expect(resolveEventJoinPath("https://evil.example/login")).toBeNull();
    expect(resolveEventJoinPath("/admin")).toBeNull();
    expect(resolveEventJoinPath("//evil.example/sport-events")).toBeNull();
    expect(resolveEventJoinPath("https://")).toBeNull();
  });

  it("only ever uses the path of a foreign link", () => {
    expect(
      resolveEventJoinPath("https://evil.example/sport-events/join/x"),
    ).toBe("/sport-events/join/x");
  });

  it("encodes odd characters in a typed code", () => {
    expect(resolveEventJoinPath("a b")).toBe("/sport-events/join/a%20b");
  });
});
