import { act, render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { SEARCH_FOCUS_DELAY_MS } from "@/lib/config/constants";
import type { Region, Spot } from "@/lib/types";
import type * as useMapFilterModule from "@/hooks/map/useMapFilter";
import type * as cityListModule from "@/hooks/map/useCityList";
import { SearchOverlay } from "./SearchOverlay";

const mocks = vi.hoisted(() => {
  const searchParams = {
    get: () => null,
    toString: () => "",
  };

  const storeState: {
    regions: unknown[];
    countrySpots: unknown[];
    citySpots: unknown[];
    nearbySpots: unknown[];
    cityScopeLoading: boolean;
  } = {
    regions: [],
    countrySpots: [],
    citySpots: [],
    nearbySpots: [],
    cityScopeLoading: false,
  };

  const filterState: {
    region: string | null;
    country: string | null;
    city: string | null;
    availableCountries: string[];
    setCountry: ReturnType<typeof vi.fn>;
    setCity: ReturnType<typeof vi.fn>;
    commit: ReturnType<typeof vi.fn>;
    commitCountryAll: ReturnType<typeof vi.fn>;
  } = {
    region: null,
    country: null,
    city: null,
    availableCountries: [],
    setCountry: vi.fn(),
    setCity: vi.fn(),
    commit: vi.fn(),
    commitCountryAll: vi.fn(),
  };

  return {
    openSearch: vi.fn(),
    replace: vi.fn(),
    onClose: vi.fn(),
    searchParams,
    storeState,
    filterState,
    fetchMock: vi.fn(),
    cityList: { useCityList: vi.fn() },
    pathname: { value: "/" },
  };
});

vi.mock("@/hooks/map/useCityList", async (importOriginal) => {
  const actual = await importOriginal<typeof cityListModule>();
  return { ...actual, useCityList: mocks.cityList.useCityList };
});

vi.mock("next/navigation", () => ({
  useSearchParams: () => mocks.searchParams,
  useRouter: () => ({ replace: mocks.replace }),
  usePathname: () => mocks.pathname.value,
}));

vi.mock("@/stores/ui-store", () => ({
  useUIStore: (selector: (state: { openSearch: () => void }) => unknown) =>
    selector({ openSearch: mocks.openSearch }),
}));

vi.mock("@/stores/spots-store", () => ({
  useSpotsStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector(mocks.storeState),
}));

vi.mock("@/hooks/map/useUserLocation", () => ({
  useUserLocation: () => ({ location: null }),
}));

vi.mock("@/hooks/preferences/useDistanceUnit", () => ({
  useDistanceUnit: () => "mi",
}));

vi.mock("@/hooks/map/useMapFilter", async (importOriginal) => {
  const actual =
    await importOriginal<typeof useMapFilterModule>();
  return {
    ...actual,
    useMapFilter: () => ({
      region: mocks.filterState.region,
      country: mocks.filterState.country,
      city: mocks.filterState.city,
      availableCountries: mocks.filterState.availableCountries,
      availableCities: [],
      filteredSpots: [],
      setRegion: vi.fn(),
      setCountry: mocks.filterState.setCountry,
      setCity: mocks.filterState.setCity,
      clearAll: vi.fn(),
      commit: mocks.filterState.commit,
      commitCountryAll: mocks.filterState.commitCountryAll,
      cancelPending: vi.fn(),
    }),
  };
});

function mockMatchMedia(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

function SearchOverlayHarness() {
  return (
    <SearchOverlay
      isOpen
      onClose={mocks.onClose}
      spots={[]}
      onSelectSpot={vi.fn()}
    />
  );
}

const latAmRegion: Region = {
  name: "Latin America",
  desc: "Latin America spots",
  count: "2.4k Spots",
  image: "",
  link: "/map?region=latin-america",
  countries: ["Colombia"],
};

function resetFilterState() {
  mocks.storeState.regions = [];
  mocks.storeState.countrySpots = [];
  mocks.storeState.citySpots = [];
  mocks.storeState.nearbySpots = [];
  mocks.storeState.cityScopeLoading = false;
  mocks.filterState.region = null;
  mocks.filterState.country = null;
  mocks.filterState.city = null;
  mocks.filterState.availableCountries = [];
  mocks.filterState.setCountry.mockClear();
  mocks.filterState.setCity.mockClear();
  mocks.filterState.commit.mockClear();
  mocks.filterState.commitCountryAll.mockClear();
  mocks.onClose.mockClear();
  mocks.fetchMock.mockReset();
  mocks.cityList.useCityList.mockReset();
  mocks.pathname.value = "/";
  // Default: settled-empty server city list (no fetch noise in tests).
  mocks.cityList.useCityList.mockImplementation(
    (country: string | null, enabled: boolean) =>
      country && enabled ? { country, cities: [], done: true } : null,
  );
  // The mocked filter state must react to country staging like the real
  // deferred picker does, or the city step can never render after a pick.
  mocks.filterState.setCountry.mockImplementation((name: string | null) => {
    mocks.filterState.country = name;
  });
}

describe("SearchOverlay focus behavior", () => {
  beforeEach(() => {
    resetFilterState();
    mocks.openSearch.mockClear();
    mocks.replace.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the search input unfocused on mobile", () => {
    mockMatchMedia(false);
    vi.useFakeTimers();

    try {
      render(<SearchOverlayHarness />);

      const dialog = screen.getByRole("dialog", { name: "Search spots" });
      const input = screen.getByRole("searchbox");
      expect(dialog).toHaveFocus();

      act(() => {
        vi.advanceTimersByTime(SEARCH_FOCUS_DELAY_MS);
      });

      expect(dialog).toHaveFocus();
      expect(input).not.toHaveFocus();
      input.focus();
      expect(input).toHaveFocus();
    } finally {
      vi.useRealTimers();
    }
  });

  it("focuses the search input on desktop after the delay", () => {
    mockMatchMedia(true);
    vi.useFakeTimers();

    try {
      render(<SearchOverlayHarness />);

      const input = screen.getByRole("searchbox");
      expect(input).not.toHaveFocus();

      act(() => {
        vi.advanceTimersByTime(SEARCH_FOCUS_DELAY_MS);
      });

      expect(input).toHaveFocus();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("SearchOverlay city step navigation", () => {
  beforeEach(() => {
    resetFilterState();
    mocks.openSearch.mockClear();
    mocks.replace.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("backs out of the city list to the country list and clears the staged city", () => {
    mockMatchMedia(true);
    mocks.storeState.regions = [latAmRegion];
    mocks.filterState.region = "Latin America";
    mocks.filterState.country = "Colombia";
    mocks.filterState.city = "bogota";

    render(<SearchOverlayHarness />);

    // Re-opening with a committed city lands on step 03…
    expect(screen.getByText("Step 03 · Colombia")).toBeTruthy();
    expect(screen.getByText("Step 03 / 03")).toBeTruthy();

    // …and "All countries" retreats to step 02, staging city: null.
    act(() => {
      screen.getByRole("button", { name: /All countries/ }).click();
    });

    expect(mocks.filterState.setCity).toHaveBeenCalledWith(null);
    expect(screen.getByText("Step 02 · Latin America")).toBeTruthy();
    expect(screen.getByText("Step 02 / 03")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /All countries/ })).toBeNull();
  });

  it("opens at the city step when only a country is committed (mandatory-city landing)", () => {
    mockMatchMedia(true);
    mocks.storeState.regions = [latAmRegion];
    mocks.filterState.region = "Latin America";
    mocks.filterState.country = "Colombia";
    mocks.filterState.availableCountries = ["Colombia"];

    render(<SearchOverlayHarness />);

    // A committed country without a city lands straight at the city step —
    // the mandatory-city gate finishes there (this is also how
    // region+country share links and off-/map country picks arrive).
    expect(screen.getByText("Step 03 · Colombia")).toBeTruthy();
    expect(screen.getByText("Step 03 / 03")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /View all Colombia spots/ }),
    ).toBeTruthy();
  });

  it("shows the city loader instead of the drill-down while a city scope loads", () => {
    mockMatchMedia(true);
    mocks.storeState.regions = [latAmRegion];
    mocks.filterState.region = "Latin America";
    mocks.filterState.country = "Colombia";
    mocks.filterState.availableCountries = ["Colombia"];
    mocks.storeState.cityScopeLoading = true;

    render(<SearchOverlayHarness />);

    const loader = screen.getByTestId("map-city-loader");
    expect(loader).toHaveAttribute("aria-label", "Loading city spots");
    expect(screen.getByText("Hang Tight")).toBeTruthy();
    // The stale city step (and its stale city list) must not render while
    // the RSC scope fetch re-hydrates the store.
    expect(screen.queryByText("Step 03 / 03")).toBeNull();
    expect(
      screen.queryByRole("button", { name: /View all Colombia spots/ }),
    ).toBeNull();
  });
});

describe("SearchOverlay country pick across routes", () => {
  beforeEach(() => {
    resetFilterState();
    mockMatchMedia(true);
    mocks.openSearch.mockClear();
    mocks.replace.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("commits and closes when a country is picked off /map (no city step off /map)", () => {
    mocks.storeState.regions = [latAmRegion];
    mocks.filterState.region = "Latin America";
    mocks.filterState.availableCountries = ["Colombia"];

    render(<SearchOverlayHarness />);

    expect(screen.getByText("Step 02 / 03")).toBeTruthy();

    act(() => {
      screen.getByRole("button", { name: /Colombia/ }).click();
    });

    expect(mocks.filterState.commit).toHaveBeenCalledTimes(1);
    expect(mocks.onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Step 03 / 03")).toBeNull();
  });

  it("passes client-dataset completeness down and skips the server city fetch", () => {
    mocks.pathname.value = "/map";
    mocks.storeState.regions = [latAmRegion];
    mocks.storeState.countrySpots = [{ id: "c-1", country: "Colombia" }];
    mocks.filterState.region = "Latin America";
    mocks.filterState.country = "Colombia";

    render(<SearchOverlayHarness />);

    // The store's countrySpots overlay provably covers the browsed country.
    expect(mocks.cityList.useCityList).toHaveBeenCalledWith("Colombia", false);
  });

  it("fetches server city truth when the store overlay belongs to another country", () => {
    mocks.pathname.value = "/map";
    mocks.storeState.regions = [latAmRegion];
    mocks.storeState.countrySpots = [{ id: "f-1", country: "France" }];
    mocks.filterState.region = "Latin America";
    mocks.filterState.country = "Colombia";

    render(<SearchOverlayHarness />);

    // Fresh country switch: the client dataset is a sliver — server truth upgrades it.
    expect(mocks.cityList.useCityList).toHaveBeenCalledWith("Colombia", true);
  });

  it("advances to the city step on /map when a country is picked, without committing", () => {
    mocks.pathname.value = "/map";
    mocks.storeState.regions = [latAmRegion];
    mocks.filterState.region = "Latin America";
    mocks.filterState.country = null;
    mocks.filterState.availableCountries = ["Colombia"];

    render(<SearchOverlayHarness />);

    act(() => {
      screen.getByRole("button", { name: /Colombia/ }).click();
    });

    // City picks commit — a plain country pick only advances the step.
    expect(mocks.filterState.setCountry).toHaveBeenCalledWith("Colombia");
    expect(mocks.filterState.commit).not.toHaveBeenCalled();
    expect(mocks.onClose).not.toHaveBeenCalled();
    expect(screen.getByText("Step 03 / 03")).toBeTruthy();
    expect(screen.getByText("No cities in this country yet")).toBeTruthy();
  });
});

function serverSpot(id: string, name: string): Spot {
  return {
    id,
    slug: `slug-${id}`,
    name,
    city: "Bogota",
    citySlug: "bogota",
    address: "calle 1",
    types: [],
    sports: [],
    image: "",
    country: "Colombia",
    countryCode: "CO",
    instagram: null,
    verificationCount: 0,
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

describe("SearchOverlay server-backed text search", () => {
  beforeEach(() => {
    resetFilterState();
    mockMatchMedia(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches DB results for text queries on public pages", async () => {
    vi.stubGlobal("fetch", mocks.fetchMock);
    mocks.fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ items: [serverSpot("srv-1", "Server Bowl")] }),
    });
    vi.useFakeTimers();

    try {
      render(<SearchOverlayHarness />);

      fireEvent.change(screen.getByRole("searchbox"), {
        target: { value: "bowl" },
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });

      expect(mocks.fetchMock).toHaveBeenCalledWith(
        "/api/spots?q=bowl&limit=20",
        expect.objectContaining({ signal: expect.anything() }),
      );
      expect(screen.getByText("Server Bowl")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("allows global city + spot search even during the /map gate and navigates in 1 click", async () => {
    vi.stubGlobal("fetch", mocks.fetchMock);
    mocks.fetchMock.mockImplementation((url: string) => {
      if (url.startsWith("/api/spots/cities")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              cities: [
                {
                  slug: "miami",
                  name: "Miami",
                  admin1: "FL",
                  spotCount: 17,
                  country: "United States",
                  region: "North America",
                },
              ],
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({ items: [serverSpot("srv-1", "Lot 11 Miami")] }),
      });
    });
    vi.useFakeTimers();

    try {
      mocks.pathname.value = "/map";
      render(<SearchOverlayHarness />);

      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      const input = screen.getByRole("searchbox");
      expect(input).not.toBeDisabled();

      fireEvent.change(input, {
        target: { value: "Miami" },
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });

      expect(mocks.fetchMock).toHaveBeenCalledWith(
        "/api/spots/cities?q=Miami&limit=8",
        expect.objectContaining({ signal: expect.anything() }),
      );
      expect(screen.getByText("Miami, FL")).toBeInTheDocument();
      expect(screen.getByText("17 spots")).toBeInTheDocument();
      expect(screen.getByText("Lot 11 Miami")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /Miami, FL/i }));
      expect(mocks.replace).toHaveBeenCalledWith(
        "/map?region=north-america&country=united-states&city=miami",
        { scroll: false },
      );
      expect(mocks.onClose).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
