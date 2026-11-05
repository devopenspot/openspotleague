import { describe, expect, it } from "vitest";
import { resolveEventJoinPath } from "@/lib/league/join-input";

describe("resolveEventJoinPath", () => {
  it("routes a bare invite code, keeping its case", () => {
    expect(resolveEventJoinPath("  abcDEF123456  ")).toBe(
      "/league/join/abcDEF123456",
    );
  });

  it("rejects empty input", () => {
    expect(resolveEventJoinPath("   ")).toBeNull();
  });

  it("accepts a full invite link", () => {
    expect(
      resolveEventJoinPath(
        "https://openspotleague.com/league/join/abcDEF123456?utm=1",
      ),
    ).toBe("/league/join/abcDEF123456");
  });

  it("accepts a relative invite link", () => {
    expect(resolveEventJoinPath("/league/join/abcDEF123456#top")).toBe(
      "/league/join/abcDEF123456",
    );
  });

  it("never follows a link anywhere else", () => {
    expect(resolveEventJoinPath("https://evil.example/login")).toBeNull();
    expect(resolveEventJoinPath("/admin")).toBeNull();
    expect(resolveEventJoinPath("//evil.example/league")).toBeNull();
    expect(resolveEventJoinPath("https://")).toBeNull();
  });

  it("only ever uses the path of a foreign link", () => {
    expect(
      resolveEventJoinPath("https://evil.example/league/join/x"),
    ).toBe("/league/join/x");
  });

  it("encodes odd characters in a typed code", () => {
    expect(resolveEventJoinPath("a b")).toBe("/league/join/a%20b");
  });
});
