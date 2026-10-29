import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Region, Spot, SpotTypeEntity } from "@/lib/types";
import { useSpotsStore } from "./spots-store";

describe("map data initialization", () => {
  beforeEach(() => {
    useSpotsStore.setState({
      spots: [],
      regions: [],
      spotTypes: [],
      countrySpots: [],
      citySpots: [],
    });
  });

  it("commits all initial datasets in one store update", () => {
    const spots = [] as readonly Spot[];
    const regions = [] as readonly Region[];
    const spotTypes = [] as readonly SpotTypeEntity[];
    const listener = vi.fn();
    const unsubscribe = useSpotsStore.subscribe(listener);

    useSpotsStore.getState().setMapData({ spots, regions, spotTypes });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(useSpotsStore.getState()).toMatchObject({
      spots,
      regions,
      spotTypes,
    });
    unsubscribe();
  });
});

describe("countrySpots slice", () => {
  const spot = (id: string) =>
    ({ id, name: `Spot ${id}` }) as unknown as Spot;

  beforeEach(() => {
    useSpotsStore.setState({
      spots: [],
      regions: [],
      spotTypes: [],
      countrySpots: [],
    });
  });

  it("sets the mirrored list without touching the base directory", () => {
    const base = [spot("base-1")] as readonly Spot[];
    const country = [spot("country-1")] as readonly Spot[];
    useSpotsStore.setState({ spots: base });

    useSpotsStore.getState().setCountrySpots(country);

    expect(useSpotsStore.getState().countrySpots).toBe(country);
    expect(useSpotsStore.getState().spots).toBe(base);
  });

  it("replaces the mirrored list with an empty one to clear it", () => {
    useSpotsStore.getState().setCountrySpots([spot("country-1")] as readonly Spot[]);

    useSpotsStore.getState().setCountrySpots([]);

    expect(useSpotsStore.getState().countrySpots).toEqual([]);
  });
});

describe("citySpots slice", () => {
  const spot = (id: string) =>
    ({ id, name: `Spot ${id}` }) as unknown as Spot;

  beforeEach(() => {
    useSpotsStore.setState({
      spots: [],
      regions: [],
      spotTypes: [],
      countrySpots: [],
      citySpots: [],
    });
  });

  it("sets the mirrored city list independently of the other slices", () => {
    const base = [spot("base-1")] as readonly Spot[];
    const city = [spot("city-1")] as readonly Spot[];
    useSpotsStore.setState({ spots: base });

    useSpotsStore.getState().setCitySpots(city);

    expect(useSpotsStore.getState().citySpots).toBe(city);
    expect(useSpotsStore.getState().spots).toBe(base);
    expect(useSpotsStore.getState().countrySpots).toEqual([]);
  });
});

describe("cityScopeLoading flag", () => {
  beforeEach(() => {
    useSpotsStore.setState({
      spots: [],
      regions: [],
      spotTypes: [],
      countrySpots: [],
      citySpots: [],
      cityScopeLoading: false,
    });
  });

  it("defaults to idle and toggles independently of the spot slices", () => {
    expect(useSpotsStore.getState().cityScopeLoading).toBe(false);

    useSpotsStore.getState().setCityScopeLoading(true);
    expect(useSpotsStore.getState().cityScopeLoading).toBe(true);
    expect(useSpotsStore.getState().citySpots).toEqual([]);

    useSpotsStore.getState().setCityScopeLoading(false);
    expect(useSpotsStore.getState().cityScopeLoading).toBe(false);
  });
});

describe("nearbySpots slice", () => {
  const spot = (id: string) =>
    ({ id, name: `Spot ${id}` }) as unknown as Spot;

  beforeEach(() => {
    useSpotsStore.setState({
      spots: [],
      regions: [],
      spotTypes: [],
      countrySpots: [],
      citySpots: [],
      nearbySpots: [],
    });
  });

  it("sets the client-walked nearby list independently of the other slices", () => {
    const base = [spot("base-1")] as readonly Spot[];
    const nearby = [spot("near-1"), spot("near-2")] as readonly Spot[];
    useSpotsStore.setState({ spots: base });

    useSpotsStore.getState().setNearbySpots(nearby);

    expect(useSpotsStore.getState().nearbySpots).toBe(nearby);
    expect(useSpotsStore.getState().spots).toBe(base);
    expect(useSpotsStore.getState().countrySpots).toEqual([]);
    expect(useSpotsStore.getState().citySpots).toEqual([]);
  });

  it("replaces the slice with an empty one to clear it", () => {
    useSpotsStore.getState().setNearbySpots([spot("near-1")] as readonly Spot[]);

    useSpotsStore.getState().setNearbySpots([]);

    expect(useSpotsStore.getState().nearbySpots).toEqual([]);
  });
});

