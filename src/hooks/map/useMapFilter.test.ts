import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReadonlyURLSearchParams } from "next/navigation";
import type * as nextNavigation from "next/navigation";
import type * as lastFilterModule from "@/lib/map/last-filter";
import type { Region, Spot } from "@/lib/types";
import { useSpotsStore } from "@/stores/spots-store";
import {
  activateFilteredMapMode,
  deriveCityOptions,
  filterSpotsByRegionAndCountry,
  resolveCityParam,
  useMapFilter,
} from "./useMapFilter";

const spot = (id: string, country: string) => ({
  id,
  country,
} as Spot);

const citySpot = (id: string, country: string, city: string, citySlug: string) => ({
  id,
  country,
  city,
  citySlug,
} as Spot);

describe("filterSpotsByRegionAndCountry", () => {
  const regions = [
    { name: "Europe", countries: ["France", "Spain"] },
    { name: "North America", countries: ["Canada"] },
  ];
  const spots = [spot("fr", "France"), spot("es", "Spain"), spot("ca", "Canada")];

  it("filters by country when no region is selected", () => {
    expect(filterSpotsByRegionAndCountry(spots, regions, null, "Spain")).toEqual([
      spots[1],
    ]);
  });

  it("applies both region and country when both are selected", () => {
    expect(filterSpotsByRegionAndCountry(spots, regions, "Europe", "Spain")).toEqual([
      spots[1],
    ]);
  });

  it("filters by citySlug within the selected country", () => {
    const citySpots = [
      citySpot("mad-1", "Spain", "Madrid", "madrid"),
      citySpot("bcn-1", "Spain", "Barcelona", "barcelona"),
    ];

    expect(
      filterSpotsByRegionAndCountry(citySpots, regions, "Europe", "Spain", "madrid"),
    ).toEqual([citySpots[0]]);
  });

  it("excludes citySlug-only matches outside the selected country", () => {
    const citySpots = [
      citySpot("mad-es", "Spain", "Madrid", "madrid"),
      citySpot("mad-us", "United States", "Madrid", "madrid"),
    ];

    expect(
      filterSpotsByRegionAndCountry(citySpots, regions, null, "Spain", "madrid"),
    ).toEqual([citySpots[0]]);
  });

  it("keeps every spot when no filter is set", () => {
    expect(filterSpotsByRegionAndCountry(spots, regions, null, null, null)).toEqual(
      spots,
    );
  });
});

describe("deriveCityOptions", () => {
  const spots = [
    citySpot("1", "Colombia", "Medellín", "medellin"),
    citySpot("2", "Colombia", "Medellín", "medellin"),
    citySpot("3", "Colombia", "Bogotá", "bogota"),
    citySpot("4", "Chile", "Santiago", "santiago"),
    citySpot("5", "Colombia", "", ""),
  ];

  it("orders by spot count (descending), ties alphabetical", () => {
    expect(deriveCityOptions(spots, "Colombia")).toEqual([
      { slug: "medellin", name: "Medellín", count: 2 },
      { slug: "bogota", name: "Bogotá", count: 1 },
    ]);
  });

  it("skips spots without a citySlug", () => {
    expect(
      deriveCityOptions(spots, "Colombia").some((o) => o.slug === ""),
    ).toBe(false);
  });

  it("ignores spots from other countries", () => {
    expect(deriveCityOptions(spots, "Peru")).toEqual([]);
  });

  it("returns an empty list when no country is selected", () => {
    expect(deriveCityOptions(spots, null)).toEqual([]);
  });
});

describe("resolveCityParam", () => {
  it("keeps the city slug whenever the country resolves, even if the client index is stale", () => {
    expect(resolveCityParam("barcelona", "Spain")).toBe("barcelona");
  });

  it("drops the city slug when no country resolves", () => {
    expect(resolveCityParam("barcelona", null)).toBeNull();
  });

  it("passes through null/empty slugs untouched", () => {
    expect(resolveCityParam(null, "Spain")).toBeNull();
    expect(resolveCityParam(undefined, "Spain")).toBeNull();
  });
});

describe("activateFilteredMapMode", () => {
  it("clears nearby and saved modes when a location filter is selected", () => {
    const result = activateFilteredMapMode(
      new URLSearchParams("nearby=1&saved=1&country=france"),
      true,
    );
    expect(result.toString()).toBe("country=france");
  });

  it("does not change mode flags when clearing location filters", () => {
    const result = activateFilteredMapMode(new URLSearchParams("nearby=1"), false);
    expect(result.toString()).toBe("nearby=1");
  });
});

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  setLastMapFilter: vi.fn(),
  clearLastMapFilter: vi.fn(),
}));

vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof nextNavigation>();
  return {
    ...actual,
    useRouter: () => ({ replace: mocks.replace }),
    usePathname: () => "/map",
  };
});

vi.mock("@/lib/map/last-filter", async (importOriginal) => {
  const actual = await importOriginal<typeof lastFilterModule>();
  return {
    ...actual,
    setLastMapFilter: mocks.setLastMapFilter,
    clearLastMapFilter: mocks.clearLastMapFilter,
  };
});

describe("useMapFilter picker commits (city gate + escape marker)", () => {
  const europe: Region = {
    name: "Europe",
    desc: "Europe spots",
    count: "1.0k Spots",
    image: "",
    link: "/map?region=europe",
    countries: ["France", "Spain"],
  };

  function useFilterFilter(params: string) {
    const searchParams = new URLSearchParams(params) as unknown as ReadonlyURLSearchParams;
    return useMapFilter([], searchParams, { defer: true });
  }

  function stagedToCountry(initialParams = "") {
    const view = renderHook(({ params }) => useFilterFilter(params), {
      initialProps: { params: initialParams },
    });
    act(() => {
      useSpotsStore.setState({ regions: [europe] });
    });
    act(() => {
      view.result.current.setRegion("Europe");
    });
    act(() => {
      view.result.current.setCountry("France");
    });
    return view;
  }

  beforeEach(() => {
    useSpotsStore.setState({ regions: [] });
    mocks.replace.mockReset();
    mocks.setLastMapFilter.mockReset();
    mocks.clearLastMapFilter.mockReset();
  });

  it("commitCountryAll escape path writes region+country with the country-wide scope marker", () => {
    const view = stagedToCountry();

    act(() => {
      view.result.current.commitCountryAll();
    });

    expect(mocks.replace).toHaveBeenCalledWith(
      "/map?region=europe&country=france&scope=country",
      { scroll: false },
    );
    expect(mocks.setLastMapFilter).toHaveBeenCalledWith("Europe", "France", null, true);
    // Pending flushed — the staged selection did not leak.
    expect(view.result.current.hasPending).toBe(false);
  });

  it("refuses the escape without a staged region+country", () => {
    const view = renderHook(({ params }) => useFilterFilter(params), {
      initialProps: { params: "" },
    });
    act(() => {
      useSpotsStore.setState({ regions: [europe] });
    });

    act(() => {
      view.result.current.commitCountryAll();
    });

    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("a real city pick removes the escape marker and persists the city", () => {
    const view = stagedToCountry("region=europe&country=france&scope=country");

    act(() => {
      view.result.current.setCity("paris");
    });
    expect(view.result.current.hasPending).toBe(true);

    act(() => {
      view.result.current.commit();
    });

    expect(mocks.replace).toHaveBeenCalledWith(
      "/map?region=europe&country=france&city=paris",
      { scroll: false },
    );
    expect(mocks.setLastMapFilter).toHaveBeenCalledWith("Europe", "France", "paris", false);
    expect(view.result.current.hasPending).toBe(false);
  });

  it("clearAll removes the escape marker and clears the last filter", () => {
    const view = stagedToCountry("region=europe&country=france&scope=country");

    act(() => {
      view.result.current.clearAll();
    });
    act(() => {
      view.result.current.commit();
    });

    expect(mocks.replace).toHaveBeenCalledWith("/map", { scroll: false });
    expect(mocks.clearLastMapFilter).toHaveBeenCalledWith();
  });
});

