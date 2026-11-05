import { describe, it, expect } from "vitest";
import { buildContestDetailUrl, buildContestMapUrl } from "./urls";

const BASE = "https://openspot.test";

function parseUrl(url: string): URL {
  return new URL(url, BASE);
}

describe("buildContestMapUrl", () => {
  it("returns the expected map URL for a fully populated event", () => {
    const url = buildContestMapUrl({
      location: { country: "United States" },
    });
    const parsed = parseUrl(url);
    expect(parsed.pathname).toBe("/map");
    expect(parsed.searchParams.get("layer")).toBe("spots,events");
    expect(parsed.searchParams.get("country")).toBe("united-states");
  });

  it("derives the country slug from the country name", () => {
    const url = buildContestMapUrl({
      location: { country: "Germany" },
    });
    const parsed = parseUrl(url);
    expect(parsed.searchParams.get("country")).toBe("germany");
  });

  it("handles diacritics in country names (Normalize NFKD)", () => {
    const url = buildContestMapUrl({
      location: { country: "Norway" },
    });
    const parsed = parseUrl(url);
    expect(parsed.searchParams.get("country")).toBe("norway");
  });

  it("emits a valid URL string with no extra params", () => {
    const url = buildContestMapUrl({
      location: { country: "Japan" },
    });
    expect(url).toMatch(/^\/map\?/);
    const parsed = parseUrl(url);
    expect([...parsed.searchParams.keys()].sort()).toEqual(["country", "layer"]);
  });

  it("includes the region slug when region is provided", () => {
    const url = buildContestMapUrl({
      location: { country: "France", region: "Europe" },
    });
    const parsed = parseUrl(url);
    expect(parsed.searchParams.get("country")).toBe("france");
    expect(parsed.searchParams.get("region")).toBe("europe");
    expect([...parsed.searchParams.keys()].sort()).toEqual(
      ["country", "layer", "region"].sort(),
    );
  });
});

describe("buildContestDetailUrl", () => {
  it("encodes the slug into the internal event path", () => {
    expect(buildContestDetailUrl("winterclash 2027")).toBe(
      "/league/winterclash%202027",
    );
  });
});
