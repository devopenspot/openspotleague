"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Search, X } from "lucide-react";
import { useSearchParams, useRouter, usePathname, type ReadonlyURLSearchParams } from "next/navigation";
import { Overlay } from "@/components/feedback/Overlay";
import { SEARCH_FOCUS_DELAY_MS } from "@/lib/config/constants";
import { ROUTES } from "@/lib/navigation/nav";
import { useUIStore } from "@/stores/ui-store";
import { useSpotsStore } from "@/stores/spots-store";
import { useEventsStore } from "@/stores/events-store";
import { useUserLocation } from "@/hooks/map/useUserLocation";
import { useDistanceUnit } from "@/hooks/preferences/useDistanceUnit";
import { getSpotDistanceInfo } from "@/lib/spots/geo";
import type { MapSpot } from "@/lib/types";
import { RegionFilter } from "@/components/shell/RegionFilter";
import {
  filterSpotsByRegionAndCountry,
  useMapFilter,
} from "@/hooks/map/useMapFilter";
import { unionById } from "@/components/map/shared/map-derived";
import { MAP_DISTANCE_UI_ENABLED } from "@/components/map/shared/map-feature-flags";
import { setMapPreserveLocation } from "@/lib/map/preserve";
import { setLastMapFilter } from "@/lib/map/last-filter";
import { slugify } from "@/lib/utils/slug";
import { useOptimisticGate } from "@/hooks/data/useOptimisticGate";
import { MapCityLoader } from "@/components/feedback/MapCityLoader";
import {
  GateNotice,
  MatchedCities,
  MatchedSpots,
  type MatchedCityItem,
} from "./search-overlay-parts";

const DESKTOP_MEDIA_QUERY = "(min-width: 768px)";
const SEARCH_SERVER_DEBOUNCE_MS = 250;
const SEARCH_SERVER_LIMIT = 20;
const SEARCH_SERVER_CITY_LIMIT = 8;
const SEARCH_SERVER_MIN_QUERY = 2;
const NO_SPOTS: readonly MapSpot[] = [];
const NO_CITIES: readonly MatchedCityItem[] = [];

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Local spot dataset for client-side filtering. The map route
   * passes the hydrated directory (base ∪ full-country overlay) —
   * complete there. Public/games pages omit it: text search is
   * server-backed and the region drill-down runs on the regions
   * catalog + the client-derived city index (city picking is a
   * map-route step; see `handleAdvanceToCities`).
   */
  spots?: readonly MapSpot[];
  onSelectSpot: (spot: MapSpot) => void;
}

export function SearchOverlay({
  isOpen,
  onClose,
  spots: spotsProp,
  onSelectSpot,
}: SearchOverlayProps) {
  const titleId = useId();
  const inputId = useId();
  const gateAlertId = useId();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const inputRef = useRef<HTMLInputElement>(null);
  const openSearch = useUIStore((s) => s.openSearch);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const regions = useSpotsStore((s) => s.regions);
  // Map page preloads the full public lists of the currently filtered
  // country (and selected city) (`countrySpots`/`citySpots`) plus the
  // Nearby mode's client-walked within-radius set (`nearbySpots`);
  // unioning them widens the capped client directory so city lists,
  // counts, and text matches are complete.
  const countrySpots = useSpotsStore((s) => s.countrySpots);
  const citySpots = useSpotsStore((s) => s.citySpots);
  const nearbySpots = useSpotsStore((s) => s.nearbySpots);
  const cityScopeLoading = useSpotsStore((s) => s.cityScopeLoading);
  const setCityScopeLoading = useSpotsStore((s) => s.setCityScopeLoading);
  const allEvents = useEventsStore((s) => s.events);
  const { location: userLocation } = useUserLocation();
  const distanceUnit = useDistanceUnit();

  const spots = spotsProp ?? NO_SPOTS;
  const scopedSpots = useMemo(
    () =>
      citySpots.length > 0 || countrySpots.length > 0 || nearbySpots.length > 0
        ? unionById(
            unionById(unionById(spots, citySpots), countrySpots),
            nearbySpots,
          )
        : spots,
    [citySpots, countrySpots, nearbySpots, spots],
  );

  const getDistanceLabel = useCallback(
    (spot: MapSpot) => {
      if (!MAP_DISTANCE_UI_ENABLED) return "";
      const info = getSpotDistanceInfo(
        spot,
        userLocation ? { lat: userLocation.lat, lon: userLocation.lon } : null,
        distanceUnit,
      );
      return info.kind === "distance" ? info.label : "—";
    },
    [userLocation, distanceUnit],
  );

  const filterSearchParams = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("spot");
    return params as unknown as ReadonlyURLSearchParams;
  }, [searchParams]);

  const {
    region,
    country,
    city,
    availableCountries,
    availableCities,
    filteredSpots,
    setRegion,
    setCountry,
    setCity,
    clearAll,
    commitCountryAll,
    commit,
    cancelPending,
  } = useMapFilter(scopedSpots, filterSearchParams, {
    targetPath: ROUTES.map,
    defer: true,
  });

  // Client city-list completeness proof for the city drill-down: the map
  // store's `countrySpots` mirrors exactly one country's full public set
  // (or nothing when the walk degrades), so a non-empty match means the
  // client-derived city list covers everything and the server-truth city
  // fetch can be skipped. Anything else — fresh picks, country switches,
  // degraded overlays — upgrades the list with server truth instead of
  // showing the capped base-directory sliver (Colombia → one city).
  const cityDatasetComplete =
    country !== null &&
    countrySpots.length > 0 &&
    countrySpots[0]?.country === country;

  // Which drill-down the region filter shows: country pick advances to the
  // city list, the "All countries" back button retreats. SearchOverlay stays
  // mounted across opens, so sync on each open transition from the committed
  // scope (pending is always discarded on close). A committed country — with
  // or without a city — opens at the city step: the mandatory-city gate
  // (region+country without city) must finish at a city pick, including
  // forced arrivals from country-less-city share links.
  const [showCities, setShowCities] = useState(false);
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) setShowCities(country !== null);
    wasOpenRef.current = isOpen;
  }, [isOpen, city, country]);

  // Only enforce forced behaviour on the map route; on other pages (home,
  // spot detail search) the overlay is a normal search and must remain dismissible.
  const isMapRoute = pathname === ROUTES.map;

  const handleAdvanceToCities = useCallback(() => {
    if (isMapRoute) {
      setShowCities(true);
      return;
    }
    // Off /map the scoped dataset is empty, so the city step has no data
    // source here: commit the staged region+country and navigate to /map.
    // The mandatory-city gate sees region+country without a city and keeps
    // the overlay forced, reopening straight at the hydrated city step.
    // `commit()` has already flushed (and nulled) the pending selection, so
    // closing without `cancelPending` is safe.
    commit();
    onClose();
  }, [commit, isMapRoute, onClose]);

  const handleBackToCountries = useCallback(() => {
    // Staging `city: null` matters: a later "View all {country} spots" commit
    // must drop a previously committed city from the URL, and `commit()`
    // no-ops while pending is empty.
    setCity(null);
    setShowCities(false);
  }, [setCity]);

  // Mandatory gate: filtered mode requires a region, a country AND a city
  // (the `scope=country` no-cities escape substitutes for the city). This
  // mirrors MapTab's validation but runs inside the overlay so the overlay
  // can become non-dismissible when the gate is active (except for hasFocus
  // deep link). Use optimistic gate so returning users whose last filter
  // resolves the gate don't see forced overlay flicker.
  const hasFocus = searchParams.get("spot") !== null;
  const { needsGate: needsFilteredGate } = useOptimisticGate(
    searchParams,
    regions,
    hasFocus,
  );
  const isForcedGate = isMapRoute && needsFilteredGate;

  useEffect(() => {
    if (!isOpen) return;
    if (isForcedGate) return;

    const id = window.setTimeout(() => {
      if (!window.matchMedia(DESKTOP_MEDIA_QUERY).matches) return;
      inputRef.current?.focus();
    }, SEARCH_FOCUS_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [isOpen, isForcedGate]);

  useEffect(() => {
    if (isOpen) openSearch();
  }, [isOpen, openSearch]);

  const searchRegionName = searchParams.get("searchRegion");
  useEffect(() => {
    if (!isOpen) return;
    if (!searchRegionName) return;
    if (!regions.some((r) => r.name === searchRegionName)) return;
    setRegion(searchRegionName);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("searchRegion");
    const cleaned = params.toString();
    router.replace(cleaned ? `${pathname}?${cleaned}` : pathname, {
      scroll: false,
    });
  }, [
    isOpen,
    searchRegionName,
    regions,
    setRegion,
    searchParams,
    router,
    pathname,
  ]);

  const handleClose = () => {
    if (isForcedGate) return;
    cancelPending();
    onClose();
  };

  // Used for RegionFilter city picks (and the country "view all" CTA) when
  // the gate is forced: the staged selection completes the gate, so the
  // close must succeed even though the stale closure still sees
  // `isForcedGate === true`.
  const handleCloseForce = () => {
    // The pick already called `commit()` which flushed pendingRef and
    // cleared pending state; `cancelPending` is safe to call anyway.
    cancelPending();
    onClose();
  };

  const handleAfterRegionFilterChange = isForcedGate
    ? handleCloseForce
    : handleClose;

  const handlePick = (spot: MapSpot) => {
    // Spot picks from the overlay are used on the map chrome to navigate
    // to detail; preserve location for the expected back-navigation (see
    // MapPageClient's preserve flag).
    setMapPreserveLocation();
    onSelectSpot(spot);
    onClose();
  };

  const handlePickCity = useCallback(
    (pickedCity: MatchedCityItem) => {
      if (pickedCity.region && pickedCity.country) {
        try {
          setLastMapFilter(
            pickedCity.region,
            pickedCity.country,
            pickedCity.slug,
            false,
          );
        } catch {
          void 0;
        }
        const params = new URLSearchParams(searchParams.toString());
        params.delete("nearby");
        params.delete("saved");
        params.delete("spot");
        params.delete("scope");
        params.set("region", slugify(pickedCity.region));
        params.set("country", slugify(pickedCity.country));
        params.set("city", pickedCity.slug);
        setCityScopeLoading?.(true);
        const targetUrl = `${ROUTES.map}?${params.toString()}`;
        if (pathname !== ROUTES.map && typeof router.push === "function") {
          router.push(targetUrl, { scroll: false });
        } else {
          router.replace(targetUrl, { scroll: false });
        }
      } else if (country) {
        setCity(pickedCity.slug);
        commit();
      }
      setQuery("");
      cancelPending();
      onClose();
    },
    [
      cancelPending,
      commit,
      country,
      onClose,
      pathname,
      router,
      searchParams,
      setCity,
      setCityScopeLoading,
    ],
  );

  const inQueryMode = deferredQuery.trim() !== "";
  // Search is available globally, including during the /map geo gate so users
  // can jump straight to a city or spot in 1 click.
  const effectiveInQueryMode = inQueryMode;

  // Server-backed text search across both spots and canonical cities.
  // Responses are keyed by the query that produced them: state is
  // never reset synchronously inside the effect (react-hooks
  // set-state-in-effect); a stale response is simply derived out when
  // the active query no longer matches its key.
  const activeQuery = !isOpen ? "" : deferredQuery.trim();
  const [serverState, setServerState] = useState<{
    q: string;
    items: readonly MapSpot[];
    cities: readonly MatchedCityItem[];
  } | null>(null);
  const [serverPending, setServerPending] = useState<string | null>(null);
  const serverMatches =
    serverState && serverState.q === activeQuery ? serverState.items : null;
  const serverCityMatches =
    serverState && serverState.q === activeQuery
      ? serverState.cities
      : NO_CITIES;
  const serverSearching =
    serverPending !== null && serverPending === activeQuery;

  useEffect(() => {
    const q = activeQuery;
    if (q.length < SEARCH_SERVER_MIN_QUERY) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setServerPending(q);
      Promise.allSettled([
        fetch(
          `/api/spots?q=${encodeURIComponent(q)}&limit=${SEARCH_SERVER_LIMIT}`,
          { signal: controller.signal },
        ).then(async (res) => {
          if (!res.ok) throw new Error(`status ${res.status}`);
          return (await res.json()) as { items?: MapSpot[] };
        }),
        fetch(
          `/api/spots/cities?q=${encodeURIComponent(q)}&limit=${SEARCH_SERVER_CITY_LIMIT}`,
          { signal: controller.signal },
        ).then(async (res) => {
          if (!res.ok) throw new Error(`status ${res.status}`);
          return (await res.json()) as { cities?: MatchedCityItem[] };
        }),
      ])
        .then(([spotsResult, citiesResult]) => {
          if (controller.signal.aborted) return;
          const items =
            spotsResult.status === "fulfilled" &&
            Array.isArray(spotsResult.value?.items)
              ? spotsResult.value.items
              : [];
          const cities =
            citiesResult.status === "fulfilled" &&
            Array.isArray(citiesResult.value?.cities)
              ? citiesResult.value.cities
              : [];
          if (
            spotsResult.status === "fulfilled" ||
            citiesResult.status === "fulfilled"
          ) {
            setServerState({ q, items, cities });
          }
          setServerPending(null);
        })
        .catch(() => {
          setServerPending(null);
        });
    }, SEARCH_SERVER_DEBOUNCE_MS);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [activeQuery]);

  const matchedSpots = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLocaleLowerCase();
    const localPool = isForcedGate ? scopedSpots : filteredSpots;
    const localMatches = !normalizedQuery
      ? localPool
      : localPool.filter((spot) =>
          [
            spot.name,
            spot.city,
            spot.country,
            ...spot.types.map((type) => type.name),
          ]
            .join(" ")
            .toLocaleLowerCase()
            .includes(normalizedQuery),
        );
    if (serverMatches !== null) {
      const filteredServer = isForcedGate
        ? serverMatches
        : filterSpotsByRegionAndCountry(
            serverMatches,
            regions,
            region,
            country,
            city,
          );
      return unionById(localMatches, filteredServer);
    }
    return localMatches;
  }, [
    serverMatches,
    isForcedGate,
    scopedSpots,
    regions,
    region,
    country,
    city,
    deferredQuery,
    filteredSpots,
  ]);
  const stepLabel = isForcedGate
    ? "Region, country & city required"
    : inQueryMode
      ? "Search"
      : region
        ? country && showCities
          ? `Step 03 · ${country}`
          : `Step 02 · ${region}`
        : "Step 01 · Regions";

  // A city-param change is in flight (RSC scope fetch, store still holds
  // the previous city's data): show the city loader instead of a stale
  // region/city drill-down or query list. Covers reopening the overlay
  // mid-navigation and the forced gate's brief window after a pick.
  const showCityScopeLoader = isOpen && cityScopeLoading;

  return (
    <Overlay
      isOpen={isOpen}
      onClose={handleClose}
      labelledBy={titleId}
      describedBy={isForcedGate ? gateAlertId : undefined}
      role={isForcedGate ? "alertdialog" : "dialog"}
      flush
      animation="top"
      closeOnBackdrop={!isForcedGate}
      initialFocus="container"
      panelClassName="overflow-y-auto bg-primary text-on-primary"
    >
      <div className="mx-auto w-full max-w-3xl p-5 sm:p-6 md:p-8">
        <div className="mb-6 flex items-center justify-between gap-4 border-b border-wire-border pb-5">
          <h2 id={titleId} className="visually-hidden">
            Search spots
          </h2>
          <div className="flex min-w-0 flex-1 items-center gap-3 rounded-full border border-wire-border bg-wire-border p-2 px-5">
            <label htmlFor={inputId} className="visually-hidden">
              Search spots by name, city, or type
            </label>
            <Search
              size={20}
              className="shrink-0 text-wire-muted"
              aria-hidden="true"
            />

            <input
              ref={inputRef}
              id={inputId}
              type="search"
              role="searchbox"
              autoComplete="off"
              placeholder={
                isForcedGate
                  ? "Search city or spot, or select below"
                  : "Search cities or spots"
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-[16px] bg-transparent text-base font-medium text-on-wire outline-none placeholder:text-wire-muted focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[9999px] text-wire-muted transition-colors hover:bg-wire-border-strong hover:text-on-wire focus-visible:outline-offset-2 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-wire"
              >
                <X size={16} aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span
              aria-hidden="true"
              className="hidden font-display text-xs font-bold tracking-widest text-wire-muted uppercase md:inline"
            >
              {stepLabel}
            </span>
            {isForcedGate ? (
              <span className="hidden md:inline-flex min-h-11 items-center rounded-full bg-on-wire px-4 font-display text-[10px] font-bold uppercase tracking-widest text-primary">
                Required
              </span>
            ) : (
              <button
                type="button"
                onClick={handleClose}
                className="flex min-h-11 items-center gap-1 rounded-[9999px] border border-wire-border bg-wire-border px-4 text-xs font-bold tracking-widest uppercase text-on-wire transition-colors hover:border-wire-border-strong hover:bg-wire-border-strong focus-visible:outline-offset-2 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-wire"
              >
                <span>Close</span>
                <kbd
                  aria-hidden="true"
                  className="hidden px-1 py-0.5 font-display text-xs text-wire-muted md:inline"
                >
                  ESC
                </kbd>
              </button>
            )}
          </div>
        </div>

        {isForcedGate && <GateNotice id={gateAlertId} />}

        <div className="mx-auto w-full max-w-3xl flex-1 [&_header]:border-wire-border [&_header_h3]:text-wire-muted [&_header_span]:text-wire-muted [&_h3]:text-wire-muted [&_button.border-outline-variant]:border-wire-border [&_button.bg-surface-container-lowest]:bg-wire-border [&_button.hover\:bg-surface-container-highest:hover]:bg-wire-border-strong [&_button.hover\:border-outline:hover]:border-wire-border-strong [&_.border-outline-variant]:border-wire-border [&_.bg-surface-container-low]:bg-wire-border [&_.text-secondary]:text-wire-muted [&_.text-on-surface-variant]:text-wire-muted [&_.bg-surface-container-high]:bg-wire-border-strong [&_button[aria-pressed=true]]:border-on-wire [&_button[aria-pressed=true]]:bg-wire-border-strong [&_button[aria-pressed=true]]:text-on-primary focus-visible:[&_button]:ring-white focus-visible:[&_button]:ring-offset-wire">
          {showCityScopeLoader ? (
            <MapCityLoader
              isOpen
              className="flex min-h-[18rem] w-full flex-1 flex-col items-center justify-center px-6 py-10"
            />
          ) : effectiveInQueryMode ? (
            <>
              <MatchedCities
                cities={serverCityMatches}
                onPickCity={handlePickCity}
              />
              <MatchedSpots
                query={deferredQuery}
                spots={matchedSpots}
                searching={serverSearching}
                onPick={handlePick}
                distanceLabel={getDistanceLabel}
              />
            </>
          ) : (
            <RegionFilter
              region={region}
              country={country}
              city={city}
              availableCountries={availableCountries}
              availableCities={availableCities}
              cityDatasetComplete={cityDatasetComplete}
              showCities={showCities}
              hasFilter={region !== null || country !== null || city !== null}
              setRegion={setRegion}
              setCountry={setCountry}
              setCity={setCity}
              clearAll={clearAll}
              onAdvanceToCities={handleAdvanceToCities}
              onBackToCountries={handleBackToCountries}
              onAfterChange={handleAfterRegionFilterChange}
              onCommit={commit}
              onCommitCountryAll={commitCountryAll}
              allSpots={scopedSpots}
              allEvents={allEvents}
            />
          )}
        </div>
      </div>
    </Overlay>
  );
}
