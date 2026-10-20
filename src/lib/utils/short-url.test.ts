import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearShortUrlMemoryCache,
  getOrFetchShortUrl,
  resolveCanonicalShareUrl,
} from "./short-url";

const mockIsShortLinksEnabled = vi.fn();

vi.mock("@/lib/config/feature-flags", () => ({
  isShortLinksEnabled: () => mockIsShortLinksEnabled(),
}));

describe("short-url client utility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearShortUrlMemoryCache();
    mockIsShortLinksEnabled.mockReturnValue(true);

    // Mock window & navigator
    vi.stubGlobal("window", {
      location: { origin: "https://openspotleague.com" },
    });
    vi.stubGlobal("navigator", {
      onLine: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("resolveCanonicalShareUrl", () => {
    it("resolves relative path to absolute URL with window origin", () => {
      expect(resolveCanonicalShareUrl("/spots/spot-1")).toBe(
        "https://openspotleague.com/spots/spot-1",
      );
    });

    it("returns absolute URLs unchanged", () => {
      expect(resolveCanonicalShareUrl("https://other.com/view")).toBe(
        "https://other.com/view",
      );
    });
  });

  describe("getOrFetchShortUrl", () => {
    it("returns canonical URL immediately when feature flag is disabled without calling fetch", async () => {
      mockIsShortLinksEnabled.mockReturnValue(false);
      const fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);

      const url = await getOrFetchShortUrl("/spots/spot-1");
      expect(url).toBe("https://openspotleague.com/spots/spot-1");
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("returns canonical URL immediately when client is offline without calling fetch", async () => {
      vi.stubGlobal("navigator", { onLine: false });
      const fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);

      const url = await getOrFetchShortUrl("/spots/spot-1");
      expect(url).toBe("https://openspotleague.com/spots/spot-1");
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("returns short URL immediately if URL is already a short link", async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);

      const url = await getOrFetchShortUrl("/s/7xK9q2A");
      expect(url).toBe("https://openspotleague.com/s/7xK9q2A");
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("fetches short link from API and caches the result", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            shortUrl: "https://openspotleague.com/s/7xK9q2A",
          }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const result1 = await getOrFetchShortUrl("/spots/spot-1", "Spot 1");
      expect(result1).toBe("https://openspotleague.com/s/7xK9q2A");
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Second call should hit in-memory cache with zero extra fetch calls
      const result2 = await getOrFetchShortUrl("/spots/spot-1");
      expect(result2).toBe("https://openspotleague.com/s/7xK9q2A");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("deduplicates concurrent in-flight requests for the same URL", async () => {
      let resolvePromise!: (val: unknown) => void;
      const deferred = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      const fetchMock = vi.fn().mockReturnValue(
        deferred.then(() => ({
          ok: true,
          json: () =>
            Promise.resolve({
              shortUrl: "https://openspotleague.com/s/dedup12",
            }),
        })),
      );
      vi.stubGlobal("fetch", fetchMock);

      const p1 = getOrFetchShortUrl("/spots/same");
      const p2 = getOrFetchShortUrl("/spots/same");

      resolvePromise(true);
      const [r1, r2] = await Promise.all([p1, p2]);

      expect(r1).toBe("https://openspotleague.com/s/dedup12");
      expect(r2).toBe("https://openspotleague.com/s/dedup12");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("gracefully falls back to canonical URL when API responds with error", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });
      vi.stubGlobal("fetch", fetchMock);

      const url = await getOrFetchShortUrl("/spots/spot-err");
      expect(url).toBe("https://openspotleague.com/spots/spot-err");
    });

    it("gracefully falls back to canonical URL when fetch throws a network error", async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error("Network connection lost"));
      vi.stubGlobal("fetch", fetchMock);

      const url = await getOrFetchShortUrl("/spots/spot-fail");
      expect(url).toBe("https://openspotleague.com/spots/spot-fail");
    });
  });
});
