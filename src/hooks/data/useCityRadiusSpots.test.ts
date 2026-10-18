import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MapSpot, Spot } from "@/lib/types";
import { useSpotsStore } from "@/stores/spots-store";
import {
  cacheKeyForCityRadius,
  useCityRadiusSpots,
} from "./useCityRadiusSpots";

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

describe("cacheKeyForCityRadius", () => {
  it("namespaces the city scope and rounds to 3 decimals", () => {
    expect(cacheKeyForCityRadius(4.71101, -74.07219)).toBe(
      "city-radius|4.711|-74.072",
    );
    expect(cacheKeyForCityRadius(4.71101, -74.07219)).toBe(
      cacheKeyForCityRadius(4.71099, -74.07221),
    );
  });
});

describe("useCityRadiusSpots", () => {
  const enabledArgs = (lat: number, lon: number) => ({
    lat,
    lon,
    enabled: true,
  });

  it("clears the slice and does not fetch when disabled or without coordinates", () => {
    useSpotsStore.getState().setCityRadiusSpots([spot("stale")] as readonly Spot[]);

    renderHook(() => useCityRadiusSpots({ lat: null, lon: null, enabled: true }));
    renderHook(() => useCityRadiusSpots({ lat: 4.711, lon: -74.0721, enabled: false }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(readCityRadiusSlice()).toEqual([]);
  });

  it("walks the scope at the city radius and mirrors the result", async () => {
    fetchMock
      .mockResolvedValueOnce(pageResponse(["1"], "cursor-1"))
      .mockResolvedValueOnce(pageResponse(["2"], null));

    renderHook(() => useCityRadiusSpots(enabledArgs(4.711, -74.0721)));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    expect(fetchMock.mock.calls[0]?.[0]).toContain("near=4.711%2C-74.0721%2C55000");
    expect(readCityRadiusSlice().map((s) => s.id)).toEqual(["1", "2"]);
  });

  it("resolves a session-cache hit without fetching", async () => {
    fetchMock.mockResolvedValue(pageResponse(["1"], null));

    renderHook(() => useCityRadiusSpots(enabledArgs(4.65, -74.1)));
    await waitFor(() => {
      expect(readCityRadiusSlice()).toEqual([spot("1")]);
    });

    // Same city re-picked (jittered centroid): served from cache
    renderHook(() => useCityRadiusSpots(enabledArgs(4.6502, -74.1003)));
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("replaces the previous city's rows when the centroid changes", async () => {
    fetchMock
      .mockResolvedValueOnce(pageResponse(["a-1"], null))
      .mockResolvedValueOnce(pageResponse(["b-1"], null));

    const { rerender } = renderHook(
      ({ lat, lon }: { lat: number; lon: number }) =>
        useCityRadiusSpots({ lat, lon, enabled: true }),
      { initialProps: { lat: 6.18, lon: -75.57 } },
    );
    await waitFor(() =>
      expect(readCityRadiusSlice().map((s) => s.id)).toEqual(["a-1"]),
    );

    // City switch: the stale rows must be dropped before the new walk
    // lands, not unioned with them.
    rerender({ lat: 6.244, lon: -75.581 });
    expect(readCityRadiusSlice()).toEqual([]);

    await waitFor(() =>
      expect(readCityRadiusSlice().map((s) => s.id)).toEqual(["b-1"]),
    );
  });

  it("refreshes the slice with partial pages but re-walks on the next visit instead of caching", async () => {
    fetchMock
      .mockResolvedValueOnce(pageResponse(["1"], "cursor-1"))
      .mockResolvedValueOnce({ ok: false });

    renderHook(() => useCityRadiusSpots(enabledArgs(3.45, -76.53)));
    await waitFor(() => expect(readCityRadiusSlice().map((s) => s.id)).toEqual(["1"]));

    fetchMock
      .mockResolvedValueOnce(pageResponse(["1", "9"], "cursor-1"))
      .mockResolvedValueOnce({ ok: false });
    renderHook(() => useCityRadiusSpots(enabledArgs(3.45, -76.53)));
    await waitFor(() => expect(readCityRadiusSlice().map((s) => s.id)).toEqual(["1", "9"]));

    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("does not write aborted walks to the store", async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));

    const { unmount } = renderHook(() =>
      useCityRadiusSpots(enabledArgs(10.5, -74.1)),
    );
    unmount();

    await act(async () => {
      await Promise.resolve();
    });
    // Clear-on-entry dropped whatever prior tests left, and the aborted
    // walk must not have added its rows back.
    expect(readCityRadiusSlice()).toEqual([]);
  });
});

function readCityRadiusSlice(): readonly MapSpot[] {
  return useSpotsStore.getState().cityRadiusSpots;
}
