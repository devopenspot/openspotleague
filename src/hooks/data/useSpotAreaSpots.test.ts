import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Spot } from "@/lib/types";
import { milesToMeters } from "@/lib/spots/geo";
import { AROUND_MAX_MILES } from "@/lib/spots/back-to-map";
import { useSpotsStore } from "@/stores/spots-store";
import {
  cacheKeyForSpotArea,
  clearSpotAreaCache,
  useSpotAreaSpots,
} from "./useSpotAreaSpots";

const fetchMock = vi.fn();

const spot = (id: string) =>
  ({ id, name: `Spot ${id}`, location: { lat: 4.9, lon: -73.9 } }) as unknown as Spot;

function pageResponse(ids: string[]) {
  return {
    ok: true,
    json: async () => ({ items: ids.map(spot), nextCursor: null }),
  };
}

beforeEach(() => {
  clearSpotAreaCache();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("cacheKeyForSpotArea", () => {
  it("rounds coordinates and includes the radius", () => {
    expect(cacheKeyForSpotArea(4.90701, -73.94221)).toBe(
      cacheKeyForSpotArea(4.90699, -73.94219),
    );
    expect(cacheKeyForSpotArea(4.907, -73.942, 1000)).not.toBe(
      cacheKeyForSpotArea(4.907, -73.942, 2000),
    );
  });
});

describe("useSpotAreaSpots", () => {
  it("stays idle when disabled", () => {
    const { result } = renderHook(() =>
      useSpotAreaSpots({ lat: 4.907, lon: -73.942, enabled: false }),
    );
    expect(result.current).toEqual({ spots: [], loading: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("walks the max around radius once and serves repeats from the cache", async () => {
    fetchMock.mockResolvedValue(pageResponse(["a", "b"]));
    const params = { lat: 4.907, lon: -73.942, enabled: true };

    const first = renderHook(() => useSpotAreaSpots(params));
    expect(first.result.current.loading).toBe(true);
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.spots.map((s) => s.id)).toEqual(["a", "b"]);

    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(decodeURIComponent(url)).toContain(
      `near=4.907,-73.942,${milesToMeters(AROUND_MAX_MILES)}`,
    );

    const second = renderHook(() => useSpotAreaSpots(params));
    expect(second.result.current).toEqual({
      spots: first.result.current.spots,
      loading: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not touch the Nearby store slice", async () => {
    useSpotsStore.getState().setNearbySpots([]);
    fetchMock.mockResolvedValue(pageResponse(["a"]));
    const { result } = renderHook(() =>
      useSpotAreaSpots({ lat: 4.907, lon: -73.942, enabled: true }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(useSpotsStore.getState().nearbySpots).toEqual([]);
  });
});
