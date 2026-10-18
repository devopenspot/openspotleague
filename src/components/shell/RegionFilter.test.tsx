import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Region, Spot } from "@/lib/types";
import type { CityOption } from "@/hooks/map/useMapFilter";
import type * as cityListModule from "@/hooks/map/useCityList";
import type { CityListState } from "@/hooks/map/useCityList";
import { useSpotsStore } from "@/stores/spots-store";
import { RegionFilter } from "./RegionFilter";

const mocks = vi.hoisted(() => ({
  useCityList: vi.fn(),
}));

vi.mock("@/hooks/map/useCityList", async (importOriginal) => {
  const actual = await importOriginal<typeof cityListModule>();
  return { ...actual, useCityList: mocks.useCityList };
});

const latinAmerica: Region = {
  name: "Latin America",
  desc: "Latin America spots",
  count: "2.4k Spots",
  image: "",
  link: "/map?region=latin-america",
  countries: ["Colombia", "Chile"],
  countryCounts: { Colombia: 163, Chile: 168 },
};

const colombiaSpot = { id: "co-1", country: "Colombia" } as Spot;

const cities = [
  { slug: "medellin", name: "Medellín", count: 2 },
  { slug: "bogota", name: "Bogotá", count: 1 },
];

interface PickerOverrides {
  country?: string | null;
  city?: string | null;
  showCities?: boolean;
  availableCountries?: readonly string[];
  availableCities?: readonly CityOption[];
  /** Provenance proof from the parent (true = client list complete). */
  cityDatasetComplete?: boolean;
  /**
   * Value returned by the mocked `useCityList` hook. Default: settled-empty
   * (no server data) — never settled cities unless overridden.
   */
  server?: CityListState | null;
  setRegion?: (name: string | null) => void;
  setCountry?: (name: string | null) => void;
  setCity?: (slug: string | null) => void;
  onAdvanceToCities?: () => void;
  onBackToCountries?: () => void;
  onCommit?: () => void;
  onCommitCountryAll?: () => void;
  onAfterChange?: () => void;
}

function renderPicker(
  region: Region,
  allSpots: readonly Spot[],
  overrides: PickerOverrides = {},
) {
  useSpotsStore.setState({ regions: [region] });
  mocks.useCityList.mockImplementation(
    (country: string | null, _enabled: boolean) =>
      overrides.server !== undefined
        ? overrides.server
        : country
          ? { country, cities: [], done: true }
          : null,
  );
  return render(
    <RegionFilter
      region={region.name}
      country={overrides.country ?? null}
      city={overrides.city ?? null}
      availableCountries={overrides.availableCountries ?? region.countries}
      availableCities={overrides.availableCities ?? []}
      cityDatasetComplete={overrides.cityDatasetComplete ?? false}
      showCities={overrides.showCities ?? false}
      hasFilter={false}
      setRegion={overrides.setRegion ?? (() => {})}
      setCountry={overrides.setCountry ?? (() => {})}
      setCity={overrides.setCity ?? (() => {})}
      clearAll={() => {}}
      onAdvanceToCities={overrides.onAdvanceToCities}
      onBackToCountries={overrides.onBackToCountries}
      onCommit={overrides.onCommit ?? (() => {})}
      onCommitCountryAll={overrides.onCommitCountryAll}
      onAfterChange={overrides.onAfterChange}
      allSpots={allSpots}
    />,
  );
}

beforeEach(() => {
  useSpotsStore.setState({ regions: [] });
  mocks.useCityList.mockReset();
});

describe("RegionFilter country counts", () => {
  it("prefers the server-truth countryCounts over client-derived counts", () => {
    renderPicker(latinAmerica, [colombiaSpot]);

    expect(screen.getByText("163 spots")).toBeTruthy();
    expect(screen.getByText("168 spots")).toBeTruthy();
    expect(screen.queryByText("1 spot")).toBeNull();
  });

  it("falls back to client-derived counts when countryCounts is absent", () => {
    renderPicker({ ...latinAmerica, countryCounts: undefined }, [colombiaSpot]);

    expect(screen.getByText("1 spot")).toBeTruthy();
    expect(screen.getByText("0 spots")).toBeTruthy();
  });

  it("falls back to client-derived counts for countries missing from the catalog", () => {
    renderPicker(
      { ...latinAmerica, countryCounts: { Chile: 168 } },
      [colombiaSpot],
    );

    expect(screen.getByText("1 spot")).toBeTruthy();
    expect(screen.getByText("168 spots")).toBeTruthy();
  });
});

describe("RegionFilter city step", () => {
  it("shows the city drill-down without count labels once a country is staged", () => {
    renderPicker(latinAmerica, [], {
      country: "Colombia",
      showCities: true,
      availableCities: cities,
      onCommit: () => {},
    });

    expect(screen.getByText("Step 03 / 03")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Colombia" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Medellín" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Bogotá" }),
    ).toBeTruthy();
    // City rows lost the per-city spot-count badge: the count data served
    // no user purpose and forced a per-country server request.
    expect(screen.queryByText(/^\d+ spots?$/)).toBeNull();
    // The mandatory-city flow has no country-wide escape in the normal
    // state: the view-all CTA only exists in the empty-list state.
    expect(
      screen.queryByRole("button", { name: /View all Colombia spots/ }),
    ).toBeNull();
  });

  it("renders the provided city order (count-descending from deriveCityOptions)", () => {
    renderPicker(latinAmerica, [], {
      country: "Colombia",
      showCities: true,
      availableCities: [
        { slug: "bogota", name: "Bogotá", count: 9 },
        { slug: "cali", name: "Cali", count: 5 },
        { slug: "armenia", name: "Armenia", count: 2 },
      ],
    });

    const list = screen.getByRole("list", { name: "Cities in Colombia" });
    const labels = within(list)
      .getAllByRole("button")
      .map((button) => button.textContent);
    expect(labels).toHaveLength(3);
    expect(labels[0]).toContain("Bogotá");
    expect(labels[1]).toContain("Cali");
    expect(labels[2]).toContain("Armenia");
  });

  it("fetches server city truth when the client dataset is not provably complete", () => {
    renderPicker(latinAmerica, [], {
      country: "Colombia",
      showCities: true,
      availableCities: cities,
    });

    expect(mocks.useCityList).toHaveBeenCalledWith("Colombia", true);
  });

  it("skips the server fetch when the client dataset provably covers the country", () => {
    renderPicker(latinAmerica, [], {
      country: "Colombia",
      showCities: true,
      availableCities: cities,
      cityDatasetComplete: true,
    });

    expect(mocks.useCityList).toHaveBeenCalledWith("Colombia", false);
  });

  it("withholds the sliver behind an honest loading pill while the server list is in flight", () => {
    renderPicker(latinAmerica, [], {
      country: "Colombia",
      showCities: true,
      availableCities: cities,
      server: null,
    });

    expect(screen.getByText("Loading cities…")).toBeTruthy();
    // The pending state replaces the misleading partial sliver entirely,
    // and the escape stays hidden (the fetch has not settled — data is
    // coming, and a mid-load escape click would be a premature bypass).
    expect(screen.queryByRole("button", { name: /Bogotá/ })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /View all Colombia spots/ }),
    ).toBeNull();
  });

  it("pins the settled server order over the client-derived sliver order", () => {
    renderPicker(latinAmerica, [], {
      country: "Colombia",
      showCities: true,
      availableCities: cities,
      server: {
        country: "Colombia",
        cities: [
          { slug: "bogota", name: "Bogotá" },
          { slug: "armenia", name: "Armenia" },
        ],
        done: true,
      },
    });

    const list = screen.getByRole("list", { name: "Cities in Colombia" });
    const labels = within(list)
      .getAllByRole("button")
      .map((button) => button.textContent);
    // Server truth: Bogotá first, Armenia next; the sliver's Medellín
    // (absent from the server list) appends after.
    expect(labels).toHaveLength(3);
    expect(labels[0]).toContain("Bogotá");
    expect(labels[1]).toContain("Armenia");
    expect(labels[2]).toContain("Medellín");
  });

  it("advances to the city list when the country pick stages, without committing", () => {
    const setCountry = vi.fn();
    const onAdvanceToCities = vi.fn();
    const onCommit = vi.fn();
    renderPicker(latinAmerica, [], {
      setCountry,
      onAdvanceToCities,
      onCommit,
    });

    screen.getByRole("button", { name: /Colombia/ }).click();

    expect(setCountry).toHaveBeenCalledWith("Colombia");
    expect(onAdvanceToCities).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("commits and closes via onAfterChange when a city is picked", () => {
    const setCity = vi.fn();
    const onCommit = vi.fn();
    const onAfterChange = vi.fn();
    renderPicker(latinAmerica, [], {
      country: "Colombia",
      showCities: true,
      availableCities: cities,
      setCity,
      onCommit,
      onAfterChange,
    });

    screen.getByRole("button", { name: /Bogotá/ }).click();

    expect(setCity).toHaveBeenCalledWith("bogota");
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onAfterChange).toHaveBeenCalledTimes(1);
  });

  it("retreats to the country list via the back button", () => {
    const onBackToCountries = vi.fn();
    renderPicker(latinAmerica, [], {
      country: "Colombia",
      showCities: true,
      availableCities: cities,
      onBackToCountries,
    });

    screen.getByRole("button", { name: /All countries/ }).click();

    expect(onBackToCountries).toHaveBeenCalledTimes(1);
  });

  it("shows an empty state when the country has no cities at all", () => {
    renderPicker(latinAmerica, [], {
      country: "Chile",
      showCities: true,
      availableCities: [],
      onCommitCountryAll: () => {},
    });

    expect(screen.getByText("No cities in this country yet")).toBeTruthy();
    // The empty state is the only exit for a city-less country under the
    // mandatory-city gate: the no-cities escape commits region+country
    // with the `scope=country` marker.
    expect(
      screen.getByRole("button", { name: /View all Chile spots/ }),
    ).toBeTruthy();
  });

  it("escapes a city-less country through commitCountryAll without staging a city", () => {
    const setCity = vi.fn();
    const onCommitCountryAll = vi.fn();
    const onAfterChange = vi.fn();
    const onCommit = vi.fn();
    renderPicker(latinAmerica, [], {
      country: "Chile",
      showCities: true,
      availableCities: [],
      setCity,
      onCommitCountryAll,
      onCommit,
      onAfterChange,
    });

    screen.getByRole("button", { name: /View all Chile spots/ }).click();

    expect(onCommitCountryAll).toHaveBeenCalledTimes(1);
    expect(onAfterChange).toHaveBeenCalledTimes(1);
    expect(setCity).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
  });
});

describe("RegionFilter picker view-all and re-entry", () => {
  it("commits the region view-all CTA without clearing the country", () => {
    const setCountry = vi.fn();
    const onCommit = vi.fn();
    const onAfterChange = vi.fn();
    renderPicker(latinAmerica, [], {
      setCountry,
      onCommit,
      onAfterChange,
    });

    screen.getByRole("button", { name: /View all Latin America spots/ }).click();

    // Dropping the country would commit a region-only scope, which the
    // mandatory region+country gate re-blocks — the CTA must not stage it.
    expect(setCountry).not.toHaveBeenCalled();
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onAfterChange).toHaveBeenCalledTimes(1);
  });

  it("re-enters the staged country's city list when its active row is clicked", () => {
    const setCountry = vi.fn();
    const onAdvanceToCities = vi.fn();
    renderPicker(latinAmerica, [], {
      country: "Colombia",
      setCountry,
      onAdvanceToCities,
    });

    const row = screen.getByRole("button", { name: /Colombia/ });
    expect((row as HTMLButtonElement).disabled).toBe(false);

    row.click();

    expect(onAdvanceToCities).toHaveBeenCalledTimes(1);
    expect(setCountry).not.toHaveBeenCalled();
  });
});
