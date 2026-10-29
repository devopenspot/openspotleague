import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mergeCityOptions, useCityList, type CityListState } from "./useCityList";

const cityOption = (slug: string, name: string, count = 0) => ({ slug, name, count });

describe("mergeCityOptions", () => {
  it("keeps server order authoritative (true spot-count order)", () => {
    const base = [
      cityOption("bogota", "Bogotá", 120),
      cityOption("cali", "Cali", 5),
    ];
    const server = [
      { slug: "bogota", name: "Bogotá" },
      { slug: "armenia", name: "Armenia" },
      { slug: "cali", name: "Cali" },
    ];

    const merged = mergeCityOptions(base, server);

    expect(merged.map((o) => o.slug)).toEqual(["bogota", "armenia", "cali"]);
  });

  it("upgrades display names to server names and keeps client counts", () => {
    const base = [cityOption("bogota", "Bógota", 9)];
    const server = [{ slug: "bogota", name: "Bogotá" }];

    const merged = mergeCityOptions(base, server);

    expect(merged).toEqual([cityOption("bogota", "Bogotá", 9)]);
  });

  it("appends client-only slugs after the server list", () => {
    const base = [
      cityOption("bogota", "Bogotá"),
      cityOption("cali", "Cali", 2),
    ];
    const server = [{ slug: "bogota", name: "Bogotá" }];

    const merged = mergeCityOptions(base, server);

    expect(merged.map((o) => o.slug)).toEqual(["bogota", "cali"]);
    expect(merged[1]?.count).toBe(2);
  });

  it("leaves the base untouched for an empty server list", () => {
    const base = [cityOption("bogota", "Bogotá")];
    expect(mergeCityOptions(base, [])).toEqual(base);
  });

  it("preserves server admin1, spotCount, and coordinates when present", () => {
    const base = [cityOption("miami", "Miami", 2)];
    const server = [
      {
        slug: "miami",
        name: "Miami",
        admin1: "FL",
        spotCount: 17,
        lat: 25.77,
        lon: -80.19,
      },
    ];
    expect(mergeCityOptions(base, server)).toEqual([
      {
        slug: "miami",
        name: "Miami",
        count: 17,
        admin1: "FL",
        spotCount: 17,
        lat: 25.77,
        lon: -80.19,
      },
    ]);
  });
});

describe("useCityList", () => {
  // Distinct countries per test keep the module-level session cache from
  // leaking results across cases.
  const realFetch = globalThis.fetch;
  const fetchMock = vi.fn();

  beforeEach(() => {
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    fetchMock.mockReset();
  });

  function flush(): Promise<unknown> {
    return act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  function cachedCities(view: { result: { current: CityListState | null } }): readonly string[] {
    return view.result.current?.cities.map((c) => c.slug) ?? [];
  }

  it("does not fetch when disabled and returns null while pending", async () => {
    const view = renderHook(() => useCityList("Colombia", false));

    expect(view.result.current).toBeNull();
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not fetch without a country", async () => {
    const view = renderHook(() => useCityList(null, true));

    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(view.result.current).toBeNull();
  });

  it("fetches once per country and serves session hits synchronously", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          cities: [
            { slug: "bogota", name: "Bogotá" },
            { slug: "medellin", name: "Medellín" },
          ],
        }),
    });

    const view = renderHook(() => useCityList("Colombia", true));
    expect(view.result.current).toBeNull();
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(view.result.current?.country).toBe("Colombia");
    expect(view.result.current?.done).toBe(true);
    expect(cachedCities(view)).toEqual(["bogota", "medellin"]);
  });

  it("resolves a re-drill of the same country without refetching", () => {
    const view = renderHook(() => useCityList("Colombia", true));
    // The first test's session cache hit resolves synchronously.
    expect(view.result.current?.done).toBe(true);
    expect(cachedCities(view)).toEqual(["bogota", "medellin"]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("settles empty on failure so the caller can fall back", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));

    const view = renderHook(() => useCityList("Peru", true));
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(view.result.current?.done).toBe(true);
    expect(view.result.current?.cities).toEqual([]);
  });

  it("drops malformed payload entries", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          cities: [
            { slug: "lima", name: "Lima" },
            { slug: "", name: "No slug" },
            null,
            { slug: "cusco" },
          ],
        }),
    });

    const view = renderHook(() => useCityList("Bolivia", true));
    await flush();

    expect(cachedCities(view)).toEqual(["lima"]);
  });
});
