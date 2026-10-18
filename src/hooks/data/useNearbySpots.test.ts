import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MapSpot, Spot } from "@/lib/types";
import { useSpotsStore } from "@/stores/spots-store";
import {
  NEARBY_SCOPE_MAX_PAGES,
  buildNearbyUrl,
  cacheKeyForNearby,
  useNearbySpots,
  walkNearbySpots,
} from "./useNearbySpots";

const fetchMock = vi.fn();

const spot = (id: string) =>
  ({
    id,
    slug: `slug-${id}`,
    name: `Spot ${id}`,
    city: "City",
    citySlug: "city",
    address: "Addr",
    types: [{ slug: "plaza", name: "Plaza" }],
    sports: ["skateboard"],
    image: "",
    country: "Colombia",
    countryCode: "CO",
    instagram: null,
    verificationCount: 0,
    visibility: "public",
    origin: "seed",
    communitySubmissionCount: 0,
    adminHidden: false,
    location: { lat: 4.711, lon: -74.0721 },
    createdBy: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }) as unknown as Spot;

function pageResponse(ids: string[], nextCursor: string | null) {
  return {
    ok: true,
    json: async () => ({ items: ids.map(spot), nextCursor }),
  };
}

beforeEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("cacheKeyForNearby", () => {
  it("rounds to 3 decimals so GPS jitter reuses the same key", () => {
    expect(cacheKeyForNearby(4.71101, -74.07219)).toBe(
      cacheKeyForNearby(4.71099, -74.07221),
    );
  });
});

describe("buildNearbyUrl", () => {
  it("carries the maximum radius, hard-capped page size, and optional cursor", () => {
    expect(buildNearbyUrl(4.711, -74.0721, null)).toBe(
      `/api/spots?near=4.711%2C-74.0721%2C160934&limit=500`,
    );
    expect(buildNearbyUrl(4.711, -74.0721, "cursor-1")).toBe(
      `/api/spots?near=4.711%2C-74.0721%2C160934&limit=500&cursor=cursor-1`,
    );
  });

  it("carries a custom radius for the shared scope walks", () => {
    expect(buildNearbyUrl(4.711, -74.0721, null, 55_000)).toBe(
      `/api/spots?near=4.711%2C-74.0721%2C55000&limit=500`,
    );
  });
});

describe("walkNearbySpots", () => {
  it("replays the cursor until the scope is exhausted and dedupes rows", async () => {
    fetchMock
      .mockResolvedValueOnce(pageResponse(["1", "2"], "cursor-1"))
      .mockResolvedValueOnce(pageResponse(["2", "3"], null));

    const outcome = await walkNearbySpots(
      4.711,
      -74.0721,
      new AbortController().signal,
    );

    expect(outcome.complete).toBe(true);
    expect(outcome.spots.map((s) => s.id)).toEqual(["1", "2", "3"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toContain("near=");
    expect(fetchMock.mock.calls[1]?.[0]).toContain("cursor=cursor-1");
  });

  it("treats the page cap as the complete documented scope", async () => {
    for (let i = 0; i < NEARBY_SCOPE_MAX_PAGES; i++) {
      fetchMock.mockResolvedValueOnce(pageResponse(["1"], `cursor-${i}`));
    }

    const outcome = await walkNearbySpots(
      4.711,
      -74.0721,
      new AbortController().signal,
    );

    expect(outcome.complete).toBe(true);
    expect(outcome.spots.map((s) => s.id)).toEqual(["1"]);
    expect(fetchMock).toHaveBeenCalledTimes(NEARBY_SCOPE_MAX_PAGES);
  });

  it("returns a non-cacheable partial when a request fails mid-walk", async () => {
    fetchMock
      .mockResolvedValueOnce(pageResponse(["1", "2"], "cursor-1"))
      .mockResolvedValueOnce({ ok: false });

    const outcome = await walkNearbySpots(
      4.711,
      -74.0721,
      new AbortController().signal,
    );

    expect(outcome.complete).toBe(false);
    expect(outcome.spots.map((s) => s.id)).toEqual(["1", "2"]);
  });

  it("returns a non-cacheable partial when fetch rejects (including abort)", async () => {
    fetchMock
      .mockResolvedValueOnce(pageResponse(["1"], "cursor-1"))
      .mockRejectedValueOnce(new Error("network down"));

    const outcome = await walkNearbySpots(
      4.711,
      -74.0721,
      new AbortController().signal,
    );

    expect(outcome.complete).toBe(false);
    expect(outcome.spots.map((s) => s.id)).toEqual(["1"]);
  });
});

describe("useNearbySpots", () => {
  const enabledArgs = (lat: number, lon: number) => ({
    lat,
    lon,
    enabled: true,
  });

  it("does not fetch when disabled or without coordinates", () => {
    renderHook(() => useNearbySpots({ lat: null, lon: null, enabled: true }));
    renderHook(() => useNearbySpots({ lat: 4.711, lon: -74.0721, enabled: false }));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("resolves a session-cache hit without fetching", async () => {
    fetchMock.mockResolvedValue(pageResponse(["1"], null));

    renderHook(() => useNearbySpots(enabledArgs(4.711, -74.0721)));
    await waitFor(() => {
      expect(readNearbySlice()).toEqual([spot("1")]);
    });

    // Jittered coordinates coalesce onto the same cache key
    renderHook(() => useNearbySpots(enabledArgs(4.71102, -74.07208)));
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("mirrors a complete two-page walk into the nearbySpots slice and caches it", async () => {
    fetchMock
      .mockResolvedValueOnce(pageResponse(["1"], "cursor-1"))
      .mockResolvedValueOnce(pageResponse(["2"], null));

    renderHook(() => useNearbySpots(enabledArgs(4.65, -74.1)));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    expect(readNearbySlice().map((s) => s.id)).toEqual(["1", "2"]);

    // Jittered coordinates coalesce onto the same cache key: no refetch
    renderHook(() => useNearbySpots(enabledArgs(4.6502, -74.1003)));
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(readNearbySlice().map((s) => s.id)).toEqual(["1", "2"]);
  });

  it("refreshes the slice with partial pages but re-walks on the next visit instead of caching", async () => {
    fetchMock
      .mockResolvedValueOnce(pageResponse(["1"], "cursor-1"))
      .mockResolvedValueOnce({ ok: false });

    renderHook(() => useNearbySpots(enabledArgs(3.45, -76.53)));
    await waitFor(() => expect(readNearbySlice().map((s) => s.id)).toEqual(["1"]));

    // Same position again: not cached, so the walk re-runs. The page-1
    // response still carries a cursor so the failure really aborts it.
    fetchMock
      .mockResolvedValueOnce(pageResponse(["1", "9"], "cursor-1"))
      .mockResolvedValueOnce({ ok: false });
    renderHook(() => useNearbySpots(enabledArgs(3.45, -76.53)));
    await waitFor(() => expect(readNearbySlice().map((s) => s.id)).toEqual(["1", "9"]));

    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("does not write aborted walks to the store", async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));

    const before = readNearbySlice();
    const { unmount } = renderHook(() =>
      useNearbySpots(enabledArgs(10.5, -74.1)),
    );
    unmount();

    await act(async () => {
      await Promise.resolve();
    });
    // The singleton store keeps whatever the prior test wrote; the
    // aborted hook must have added nothing to it.
    expect(readNearbySlice()).toBe(before);
  });
});

function readNearbySlice(): readonly MapSpot[] {
  return useSpotsStore.getState().nearbySpots;
}
