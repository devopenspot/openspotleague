import { renderHook } from "@testing-library/react";
import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Spot } from "@/lib/types";
import { useSpotsStore } from "@/stores/spots-store";
import { useWeatherVerification } from "./useWeatherVerification";

const fetchMock = vi.fn();

vi.mock("@/hooks/ui/useToast", () => ({ showToast: vi.fn() }));

function makeSpot(id: string, count: number): Spot {
  return {
    id,
    slug: `slug-${id}`,
    name: `Spot ${id}`,
    city: "Bogota",
    citySlug: "bogota",
    address: "calle 1",
    types: [],
    sports: [],
    image: "",
    country: "Colombia",
    countryCode: "CO",
    instagram: null,
    verificationCount: count,
    visibility: "public",
    origin: "seed",
    communitySubmissionCount: 0,
    adminHidden: false,
    location: { lat: 4.6, lon: -74.06 },
    createdBy: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function mockSuccessVerification(count: number) {
  fetchMock.mockImplementation(async (_input: unknown, init?: RequestInit) => {
    if (init?.method === "POST") {
      return {
        ok: true,
        json: async () => ({ ok: true, count, weather: { count } }),
      };
    }
    return {
      ok: true,
      json: async () => ({ weather: null }),
    };
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  useSpotsStore.setState({
    spots: [],
    regions: [],
    spotTypes: [],
    countrySpots: [],
    citySpots: [],
    nearbySpots: [],
  });
});

describe("useWeatherVerification summary cache", () => {
  it("revalidates a cached summary on remount instead of trusting it", async () => {
    const spotId = "cache-1";
    fetchMock.mockClear();
    const active = { active: true, leader: "rain", count: 2, expiresAt: null, totalActive: 2 };
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ weather: active }) });

    const first = renderHook(() => useWeatherVerification(spotId));
    await vi.waitFor(() => expect(first.result.current.summary).toEqual(active));
    first.unmount();

    // The votes expired while unmounted; the server now reports no summary.
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ weather: null }) });
    const second = renderHook(() => useWeatherVerification(spotId));
    expect(second.result.current.summary).toEqual(active);
    await vi.waitFor(() => expect(second.result.current.summary).toBeNull());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("useWeatherVerification optimistic count bump", () => {
  it("bumps country-only spots inside the countrySpots slice", async () => {
    const spot = makeSpot("co-9", 3);
    mockSuccessVerification(10);
    useSpotsStore.setState({ countrySpots: [spot] });

    const { result, rerender } = renderHook(
      ({ spotId }) => useWeatherVerification(spotId),
      { initialProps: { spotId: null as string | null } },
    );
    rerender({ spotId: spot.id });

    await act(async () => {
      await result.current.verify({
        latitude: 4.6,
        longitude: -74.06,
        voteIcon: "sunny",
      });
    });

    expect(useSpotsStore.getState().countrySpots[0]?.verificationCount).toBe(10);
    expect(useSpotsStore.getState().spots).toEqual([]);
  });

  it("bumps nearby-only spots inside the nearbySpots slice", async () => {
    const spot = makeSpot("near-1", 1);
    mockSuccessVerification(8);
    useSpotsStore.setState({ nearbySpots: [spot] });

    const { result, rerender } = renderHook(
      ({ spotId }) => useWeatherVerification(spotId),
      { initialProps: { spotId: null as string | null } },
    );
    rerender({ spotId: spot.id });

    await act(async () => {
      await result.current.verify({
        latitude: 4.6,
        longitude: -74.06,
        voteIcon: "sunny",
      });
    });

    expect(useSpotsStore.getState().nearbySpots[0]?.verificationCount).toBe(8);
    expect(useSpotsStore.getState().spots).toEqual([]);
    expect(useSpotsStore.getState().countrySpots).toEqual([]);
  });

  it("bumps base-directory spots inside the spots list", async () => {
    const spot = makeSpot("base-1", 2);
    mockSuccessVerification(9);
    useSpotsStore.setState({ spots: [spot] });

    const { result, rerender } = renderHook(
      ({ spotId }) => useWeatherVerification(spotId),
      { initialProps: { spotId: null as string | null } },
    );
    rerender({ spotId: spot.id });

    await act(async () => {
      await result.current.verify({
        latitude: 4.6,
        longitude: -74.06,
        voteIcon: "sunny",
      });
    });

    expect(useSpotsStore.getState().spots[0]?.verificationCount).toBe(9);
    expect(useSpotsStore.getState().countrySpots).toEqual([]);
  });

  it("reverts the optimistic bump in the countrySpots slice on failure", async () => {
    const spot = makeSpot("co-9", 3);
    fetchMock.mockImplementation(async (_input: unknown, init?: RequestInit) => {
      if (init?.method === "POST") {
        return { ok: false, json: async () => ({ error: "boom" }) };
      }
      return { ok: true, json: async () => ({ weather: null }) };
    });
    useSpotsStore.setState({ countrySpots: [spot] });

    const { result, rerender } = renderHook(
      ({ spotId }) => useWeatherVerification(spotId),
      { initialProps: { spotId: null as string | null } },
    );
    rerender({ spotId: spot.id });

    await expect(
      act(async () => {
        await result.current.verify({
          latitude: 4.6,
          longitude: -74.06,
          voteIcon: "sunny",
        });
      }),
    ).rejects.toThrow("boom");

    expect(useSpotsStore.getState().countrySpots[0]?.verificationCount).toBe(3);
  });
});
