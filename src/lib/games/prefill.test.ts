import { describe, expect, it } from "vitest";
import { buildGamePrefillUrl, parseGamePrefill } from "./prefill";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

function makeSpot(types: { slug: string; name: string }[] = [{ slug: "ledge", name: "Ledge" }]) {
  return { id: VALID_UUID, types } as unknown as { id: string; types: { slug: string; name: string }[] };
}

describe("parseGamePrefill", () => {
  it("parses valid uuid", () => {
    const params = new URLSearchParams(`spotId=${VALID_UUID}`);
    expect(parseGamePrefill(params).spotId).toBe(VALID_UUID);
  });

  it("returns null for invalid uuid", () => {
    const params = new URLSearchParams("spotId=not-uuid");
    expect(parseGamePrefill(params).spotId).toBeNull();
  });

  it("lowercases spotType", () => {
    const params = new URLSearchParams("spotType=Plaza");
    expect(parseGamePrefill(params).spotType).toBe("plaza");
  });

  it("returns null for empty spotType", () => {
    const params = new URLSearchParams("spotType=");
    expect(parseGamePrefill(params).spotType).toBeNull();
  });

  it("parses challenge mode", () => {
    const params = new URLSearchParams("mode=challenge");
    expect(parseGamePrefill(params).mode).toBe("challenge");
  });

  it("returns null for unknown mode", () => {
    const params = new URLSearchParams("mode=foo");
    expect(parseGamePrefill(params).mode).toBeNull();
  });

  it("ignores unknown params", () => {
    const params = new URLSearchParams("foo=bar");
    const parsed = parseGamePrefill(params);
    expect(parsed).toEqual({ spotId: null, spotType: null, mode: null });
  });
});

describe("buildGamePrefillUrl", () => {
  it("builds url with default spotType", () => {
    const url = buildGamePrefillUrl(makeSpot([{ slug: "ledge", name: "Ledge" }]));
    expect(url).toBe(`/games?spotId=${VALID_UUID}&spotType=ledge`);
  });

  it("builds url with explicit spotType and mode", () => {
    const url = buildGamePrefillUrl(makeSpot(), { spotType: "rail", mode: "training" });
    expect(url).toContain(`spotId=${VALID_UUID}`);
    expect(url).toContain("spotType=rail");
    expect(url).toContain("mode=training");
  });

  it("round-trips via parse", () => {
    const spot = makeSpot([{ slug: "plaza", name: "Plaza" }]);
    const url = buildGamePrefillUrl(spot, { mode: "challenge" });
    const query = new URLSearchParams(url.split("?")[1] ?? "");
    const parsed = parseGamePrefill(query);
    expect(parsed.spotId).toBe(VALID_UUID);
    expect(parsed.spotType).toBe("plaza");
    expect(parsed.mode).toBe("challenge");
  });
});
