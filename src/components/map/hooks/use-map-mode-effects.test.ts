import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Spot } from "@/lib/types";
import { DEFAULT_NEARBY_RADIUS_MI } from "@/stores/user-location-store";
import { useMapModeEffects } from "./use-map-mode-effects";

const spot = (id: string, country: string) =>
  ({
    id,
    country,
    citySlug: "city",
    city: "City",
    types: [{ name: "Plaza" }],
    location: { lat: Number(id), lon: Number(id) },
  }) as unknown as Spot;

type EffectProps = Parameters<typeof useMapModeEffects>[0];

function setup(
  overrides: Partial<EffectProps> = {},
): {
  props: EffectProps;
  fitBoundsToVisibleItems: ReturnType<typeof vi.fn>;
} {
  const fitBoundsToVisibleItems = vi.fn();
  const props: EffectProps = {
    mode: "filtered",
    isAuthenticated: true,
    status: "granted",
    location: null,
    radiusMiles: DEFAULT_NEARBY_RADIUS_MI,
    sourceSpots: [],
    activePinId: null,
    hasRegionFilter: true,
    region: "Latin America",
    country: "Colombia",
    city: null,
    layerKey: "spots,events",
    setRadiusMiles: vi.fn(),
    setActivePin: vi.fn(),
    dismissSaved: vi.fn(),
    fitRadius: vi.fn(),
    fitBoundsToVisibleItems,
    hasFocus: false,
    ...overrides,
  };
  return { props, fitBoundsToVisibleItems };
}

describe("useMapModeEffects filtered recenter", () => {
  it("recents the viewport when a city is committed", () => {
    const { props, fitBoundsToVisibleItems } = setup();
    const { rerender } = renderHook(
      (city: string | null) => useMapModeEffects({ ...props, city }),
      { initialProps: null as string | null },
    );

    const before = fitBoundsToVisibleItems.mock.calls.length;

    rerender("bogota");

    expect(fitBoundsToVisibleItems.mock.calls.length).toBe(before + 1);
  });

  it("recents back to the country when the committed city is cleared", () => {
    const { props, fitBoundsToVisibleItems } = setup({ city: "bogota" });
    const { rerender } = renderHook(
      (city: string | null) => useMapModeEffects({ ...props, city }),
      { initialProps: "bogota" as string | null },
    );

    const before = fitBoundsToVisibleItems.mock.calls.length;

    rerender(null);

    expect(fitBoundsToVisibleItems.mock.calls.length).toBe(before + 1);
  });

  it("does not refit on unrelated prop changes with the same city", () => {
    const { props, fitBoundsToVisibleItems } = setup({ city: "bogota" });
    const { rerender } = renderHook(
      (activePinId: string | null) =>
        useMapModeEffects({ ...props, activePinId }),
      { initialProps: null as string | null },
    );

    const before = fitBoundsToVisibleItems.mock.calls.length;

    rerender("spot-1");

    expect(fitBoundsToVisibleItems.mock.calls.length).toBe(before);
  });

  it("keeps the map alone when a focused deep link is active", () => {
    const { props, fitBoundsToVisibleItems } = setup({
      hasFocus: true,
      city: "bogota",
    });
    renderHook(() => useMapModeEffects(props));

    expect(fitBoundsToVisibleItems).not.toHaveBeenCalled();
  });
});

describe("useMapModeEffects country-data refit", () => {
  it("defers the city-commit refit until the full country list arrives", () => {
    const staleForeign = [spot("1", "Colombia"), spot("2", "Colombia")];
    const { props, fitBoundsToVisibleItems } = setup({
      region: "Europe",
      country: "Spain",
      countrySpots: staleForeign,
      sourceSpots: [],
    });
    const { rerender } = renderHook(
      (partial: Partial<EffectProps>) =>
        useMapModeEffects({ ...props, ...partial }),
      { initialProps: {} as Partial<EffectProps> },
    );

    const before = fitBoundsToVisibleItems.mock.calls.length;

    rerender({ city: "barcelona" });
    expect(fitBoundsToVisibleItems.mock.calls.length).toBe(before);

    const spainList = [
      spot("3", "Spain"),
      spot("4", "Spain"),
      spot("5", "Spain"),
    ];
    rerender({ sourceSpots: spainList, countrySpots: spainList });
    expect(fitBoundsToVisibleItems.mock.calls.length).toBe(before + 1);
  });

  it("refits when the full list grows the dataset for an unchanged selection", () => {
    const capSubset = [spot("1", "Spain"), spot("2", "Spain")];
    const { props, fitBoundsToVisibleItems } = setup({
      region: "Europe",
      country: "Spain",
      countrySpots: capSubset,
      sourceSpots: capSubset,
    });
    const { rerender } = renderHook(
      (partial: Partial<EffectProps>) =>
        useMapModeEffects({ ...props, ...partial }),
      { initialProps: {} as Partial<EffectProps> },
    );

    const before = fitBoundsToVisibleItems.mock.calls.length;

    const fullList = Array.from({ length: 9 }, (_, i) =>
      spot(String(i + 1), "Spain"),
    );
    rerender({ sourceSpots: fullList, countrySpots: fullList });

    expect(fitBoundsToVisibleItems.mock.calls.length).toBe(before + 1);
  });

  it("does not refit when a same-size list is re-delivered", () => {
    const list = [spot("1", "Spain"), spot("2", "Spain"), spot("3", "Spain")];
    const { props, fitBoundsToVisibleItems } = setup({
      region: "Europe",
      country: "Spain",
      countrySpots: list,
      sourceSpots: list,
    });
    const { rerender } = renderHook(
      (partial: Partial<EffectProps>) =>
        useMapModeEffects({ ...props, ...partial }),
      { initialProps: {} as Partial<EffectProps> },
    );

    const before = fitBoundsToVisibleItems.mock.calls.length;

    rerender({
      sourceSpots: [...list],
      countrySpots: [...list],
    });

    expect(fitBoundsToVisibleItems.mock.calls.length).toBe(before);
  });

  it("fits the committed city as soon as the city dataset lands, despite a stale country list", () => {
    const staleForeign = [spot("1", "Colombia"), spot("2", "Colombia")];
    const { props, fitBoundsToVisibleItems } = setup({
      region: "Europe",
      country: "Spain",
      countrySpots: staleForeign,
      sourceSpots: [],
    });
    const { rerender } = renderHook(
      (partial: Partial<EffectProps>) =>
        useMapModeEffects({ ...props, ...partial }),
      { initialProps: {} as Partial<EffectProps> },
    );

    const before = fitBoundsToVisibleItems.mock.calls.length;

    rerender({ city: "barcelona" });
    expect(fitBoundsToVisibleItems.mock.calls.length).toBe(before);

    const cityList = [
      { ...spot("9", "Spain"), city: "Barcelona", citySlug: "barcelona" },
      { ...spot("10", "Spain"), city: "Barcelona", citySlug: "barcelona" },
    ];
    rerender({ city: "barcelona", citySpots: cityList, sourceSpots: cityList });

    expect(fitBoundsToVisibleItems.mock.calls.length).toBe(before + 1);
  });
});
