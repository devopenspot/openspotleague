"use client";
import { useCallback, useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { useRouter, type ReadonlyURLSearchParams } from "next/navigation";
import { useSpotsStore } from "@/stores/spots-store";
import { useEventsStore } from "@/stores/events-store";
import { useMapStore } from "@/stores/map-store";
import { useUserLocation } from "@/hooks/map/useUserLocation";
import { useMapFilter } from "@/hooks/map/useMapFilter";
import { useMapActions } from "@/components/map/hooks/use-map-actions";
import { useSavedSpots } from "@/hooks/data/useSavedSpots";
import { useUser } from "@/lib/contexts/user-context";
import type { SportDiscipline } from "@/types/sport-events";
import { cn } from "@/lib/utils/cn";
import { SignInLink } from "@/components/shell/SignInLink";

import {
  deriveMapScopeLabel,
  deriveMapSpotView,
  deriveMapViewportPoints,
  deriveSpotCentroid,
  deriveSpotCityDisplayName,
  filterMapEventsByGeo,
  unionById,
} from "@/components/map/shared/map-derived";
import { MapInfoPopup } from "@/components/map/panels/MapInfoPopup";
import { MapControls } from "@/components/map/controls/MapControls";
import { useMapViewport } from "@/components/map/panels/MapViewportContext";
import { useMapDataStatus } from "@/components/map/panels/MapProvider";
import { MapCityLoader } from "@/components/feedback/MapCityLoader";
import { useMapLayer } from "@/hooks/map/useMapLayer";
import { usePreferencesStore } from "@/stores/preferences-store";
import type { MapSpot } from "@/lib/types";
import type {
  UserLocationError,
  UserLocationStatus,
} from "@/stores/user-location-store";
import { LocationBlockedCallout } from "@/components/ui/LocationBlockedCallout";
import {
  requestedMapMode,
  shouldCloseGateSearch,
  type RequestedMapMode,
} from "@/components/map/shared/map-mode";
import { useMapModeEffects } from "@/components/map/hooks/use-map-mode-effects";
import { useUIStore } from "@/stores/ui-store";
import { useOptimisticGate } from "@/hooks/data/useOptimisticGate";
import { useNearbySpots } from "@/hooks/data/useNearbySpots";
import { showToast } from "@/hooks/ui/useToast";

const LeafletCanvas = dynamic(
  () =>
    import("@/components/map/controls/LeafletCanvas").then(
      (m) => m.LeafletCanvas,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 border border-outline-variant bg-surface-container-low " />
    ),
  },
);

const NEAR_YOU_INITIAL_ZOOM = 10;
const NO_SPOTS: readonly MapSpot[] = [];

const MAP_NOTICE_CLASS =
  "pointer-events-auto flex gap-3 rounded-lg border-2 border-outline-variant bg-surface/95 p-4 text-on-surface";
const MAP_NOTICE_ROW_CLASS = `${MAP_NOTICE_CLASS} flex-wrap items-center justify-between`;
const MAP_NOTICE_TITLE_CLASS =
  "font-display text-xs font-semibold uppercase tracking-[0.05em]";
const MAP_NOTICE_BODY_CLASS =
  "text-sm font-semibold leading-5 text-secondary";
const MAP_ACTION_BASE_CLASS =
  "inline-flex min-h-12 shrink-0 items-center justify-center rounded-lg border-2 px-4 font-display text-sm font-bold uppercase tracking-[0.04em] transition-[background-color,transform] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 active:translate-y-px";
const MAP_ACTION_PRIMARY_CLASS = `${MAP_ACTION_BASE_CLASS} border-primary bg-primary text-on-primary hover:bg-primary/90`;

function nearbyNoticeMessage(
  status: UserLocationStatus,
  error: UserLocationError | null,
): string {
  if (status === "denied") {
    return "Location is blocked. Allow location in your browser settings, close this tab and open again, then tap Try again.";
  }
  if (status === "requesting") return "Requesting your location...";
  if (status === "unavailable") {
    switch (error) {
      case "insecure-context":
        return "Location requires a secure connection.";
      case "unsupported":
        return "Location is unavailable in this browser or page context.";
      case "timeout":
        return "Location lookup timed out. Try again where you have a clearer signal.";
      default:
        return "Your location is temporarily unavailable. Try again.";
    }
  }
  return "Allow location to show spots near you.";
}

function nearbyNoticeActionLabel(status: UserLocationStatus): string {
  if (status === "denied") return "Fix location";
  if (status === "unavailable") return "Try again";
  return "Use location";
}

interface MapTabProps {
  searchParams: ReadonlyURLSearchParams;
}

export default function MapTab({ searchParams }: MapTabProps) {
  const spots = useSpotsStore((s) => s.spots);
  const countrySpots = useSpotsStore((s) => s.countrySpots);
  const citySpots = useSpotsStore((s) => s.citySpots);
  const nearbySpots = useSpotsStore((s) => s.nearbySpots);
  const cityScopeLoading = useSpotsStore((s) => s.cityScopeLoading);
  const preferredSport = usePreferencesStore((s) => s.preferredSport);
  const regions = useSpotsStore((s) => s.regions);
  const allEvents = useEventsStore((s) => s.events);
  const router = useRouter();
  const dataStatus = useMapDataStatus();
  const {
    location,
    status,
    error,
    radiusMiles,
    setRadiusMiles,
    request: requestLocation,
  } = useUserLocation();
  const scopedSpots = useMemo(
    () =>
      citySpots.length > 0 || countrySpots.length > 0
        ? unionById(unionById(spots, citySpots), countrySpots)
        : spots,
    [citySpots, countrySpots, spots],
  );
  const preferenceSpots = useMemo(
    () =>
      preferredSport && preferredSport !== "all"
        ? scopedSpots.filter((spot) =>
            spot.sports.includes(preferredSport as SportDiscipline),
          )
        : scopedSpots,
    [preferredSport, scopedSpots],
  );
  const { region, country, city, filteredSpots } = useMapFilter(
    preferenceSpots,
    searchParams,
  );
  const { dismissSaved } = useMapActions();
  const user = useUser();
  const { savedIds } = useSavedSpots(user?.id ?? null);
  const { fitRadius, fitBoundsToVisibleItems, flyToSpot } = useMapViewport();
  const { enabled: enabledLayers } = useMapLayer();
  const setActivePin = useMapStore((s) => s.setActivePin);
  const clearActivePins = useMapStore((s) => s.clearActivePins);
  const activePinId = useMapStore((s) => s.activePinId);
  const activeEventId = useMapStore((s) => s.activeEventId);

  // Focus target from "View on map" deep link: /map?country=...&spot=<id>
  // Must centre on that spot and reveal its pin. Kept in URL so refresh
  // re-applies the focus without cross-route state.
  const focusedSpotId = searchParams.get("spot");
  const focusedSpot = useMemo(
    () =>
      focusedSpotId
        ? (scopedSpots.find((s) => s.id === focusedSpotId) ?? null)
        : null,
    [focusedSpotId, scopedSpots],
  );
  const hasFocus = focusedSpot !== null;

  const requestedMode: RequestedMapMode = requestedMapMode(
    new URLSearchParams(searchParams.toString()),
  );

  // Optimistic gate: if localStorage has valid last filter, suppress gate visuals
  // and avoid flicker before MapPageClient's router.replace heals the URL.
  const {
    needsGate: needsFilteredGeoSelection,
    willRestore,
    baseNeeds,
  } = useOptimisticGate(searchParams, regions, hasFocus);

  // City-scope transition: a committed city-param change re-fetches the
  // RSC scope while the URL (and filtered view) still shows the previous
  // city. Cover the canvas with the city loader until the mirrored
  // payload clears the flag in `MapPageClient` — Leaflet stays mounted
  // underneath (no remount), and the gate window after a forced-gate
  // city pick is covered too (the URL still feels gated until it lands).
  const cityScopeLoadingActive =
    cityScopeLoading &&
    requestedMode === "filtered" &&
    !willRestore &&
    !hasFocus;

  // When the gate is active (and not just willRestore) the search overlay must open and stay forced
  // until the user completes the region+country+city selection (or the
  // no-cities escape resolves it) — the mandatory-city gate opens straight
  // at the city step.
  const gateWasForcedRef = useRef(false);
  useEffect(() => {
    if (needsFilteredGeoSelection) {
      gateWasForcedRef.current = true;
      useUIStore.getState().openSearch();
      return;
    }
    // The gate resolved because the user switched to Nearby/Saved rather
    // than completing a region+country pick — the forced overlay belongs
    // to the filtered gate, not to those modes, so drop it. Filtered-mode
    // resolution closes the overlay itself (region pick commit) and must
    // not double-close here.
    if (
      gateWasForcedRef.current &&
      shouldCloseGateSearch(gateWasForcedRef.current, false, requestedMode)
    ) {
      gateWasForcedRef.current = false;
      useUIStore.getState().closeSearch();
    }
  }, [needsFilteredGeoSelection, requestedMode]);

  const userLatLon = useMemo(
    () => (location ? { lat: location.lat, lon: location.lon } : null),
    [location],
  );

  const hasRegionFilter = region !== null || country !== null;
  // When a focus spot is present (deep link from spot detail), it takes
  // precedence over nearby/saved modes — the requirement is to show the
  // spot's country with that spot centred, even if the URL also carried
  // mode flags (defensive).
  const nearYou =
    !hasFocus &&
    requestedMode === "nearby" &&
    status === "granted" &&
    userLatLon !== null;
  const nearbyNeedsLocation =
    !hasFocus && requestedMode === "nearby" && !nearYou;
  const savedModeActive =
    !hasFocus && requestedMode === "saved" && user !== null;
  const spotsDegraded = dataStatus.spots === "degraded";
  const eventsDegraded = dataStatus.events === "degraded";
  // Nearby walks the complete within-radius set client-side (the capped
  // name-ordered directory alone yields zero nearby pins on the seeded
  // catalog) — union is base order + the walked scope overlay.
  const nearbySource = useMemo(
    () => (nearbySpots.length > 0 ? unionById(spots, nearbySpots) : spots),
    [nearbySpots, spots],
  );
  useNearbySpots({
    lat: userLatLon?.lat ?? null,
    lon: userLatLon?.lon ?? null,
    enabled: nearYou,
  });
  // Server-delivered `citySpots` includes both the canonical city spots and
  // any public spots within the 28km metro radius (including neighboring
  // cities and border-crossing spots). Derive the centroid from the city's
  // own spots first (falling back to all `citySpots`) and merge the sport-
  // filtered `citySpots` into `sourceSpots`.
  const cityScopeActive =
    city !== null && !hasFocus && !savedModeActive && !nearYou;
  const cityCentroid = useMemo(
    () =>
      cityScopeActive && citySpots.length > 0
        ? (deriveSpotCentroid(
            citySpots.filter((s) => s.citySlug === city),
          ) ?? deriveSpotCentroid(citySpots))
        : null,
    [city, cityScopeActive, citySpots],
  );
  const cityServerScope = useMemo(() => {
    if (!cityScopeActive || citySpots.length === 0) return NO_SPOTS;
    return preferredSport && preferredSport !== "all"
      ? citySpots.filter((s) =>
          s.sports.includes(preferredSport as SportDiscipline),
        )
      : citySpots;
  }, [cityScopeActive, citySpots, preferredSport]);
  const sourceSpots = useMemo(() => {
    // Mandatory gate: when filtered mode requires region+country+city, hide spots until the gate completes.
    // Use baseNeeds (not just visual needsGate) so while willRestore (optimistic) we keep skeleton, not unfiltered spots.
    if (baseNeeds) return [];
    // Ensure the deep-link target remains visible even if the URL was
    // manually tampered (country param != spot's country). Spec path
    // always produces a consistent country, so this is defensive.
    if (hasFocus && focusedSpot) {
      const inFiltered = filteredSpots.some((s) => s.id === focusedSpot.id);
      if (!inFiltered) return [focusedSpot, ...filteredSpots];
    }
    if (savedModeActive) {
      return spots.filter((s) => savedIds.has(s.id));
    }
    if (nearYou) return nearbySource;
    if (cityServerScope.length > 0) {
      return unionById(filteredSpots, cityServerScope);
    }
    return filteredSpots;
  }, [
    baseNeeds,
    hasFocus,
    focusedSpot,
    savedModeActive,
    nearYou,
    nearbySource,
    spots,
    savedIds,
    filteredSpots,
    cityServerScope,
  ]);

  // Bottom-left scope pill: filtered mode only — nearby/saved/focus hide it
  // (nearby and saved override geo filters; a focus deep link's URL country
  // can be tampered). `city` is the canonical slug; the display name is
  // resolved server-truth-first (`citySpots`) so the pill never leaks a slug.
  const scopeLabel = useMemo(() => {
    if (cityScopeLoadingActive) return null;
    if (requestedMode !== "filtered" || hasFocus) return null;
    const cityName = deriveSpotCityDisplayName(
      unionById(filteredSpots, citySpots),
      country,
      city,
    );
    return deriveMapScopeLabel(cityName, country);
  }, [
    cityScopeLoadingActive,
    requestedMode,
    hasFocus,
    filteredSpots,
    citySpots,
    country,
    city,
  ]);

  const locationFilteredEvents = useMemo(
    () => filterMapEventsByGeo(allEvents, regions, region, country, city),
    [allEvents, city, country, region, regions],
  );
  const filteredEvents = useMemo(() => {
    if (baseNeeds) return [];
    // Nearby and saved modes intentionally override geographic spot filters;
    // keep the event layer consistent with those existing spot semantics.
    return nearYou || savedModeActive ? allEvents : locationFilteredEvents;
  }, [baseNeeds, allEvents, locationFilteredEvents, nearYou, savedModeActive]);

  const spotView = useMemo(
    () =>
      deriveMapSpotView(
        sourceSpots,
        userLatLon,
        nearYou ? radiusMiles : undefined,
      ),
    [nearYou, radiusMiles, sourceSpots, userLatLon],
  );

  const activeSpotIsVisible =
    activePinId === null ||
    (hasFocus && activePinId === focusedSpotId) ||
    (enabledLayers.has("spots") &&
      spotView.spots.some((spot) => spot.id === activePinId));
  const activeEventIsVisible =
    activeEventId === null ||
    (enabledLayers.has("events") &&
      filteredEvents.some((event) => event.id === activeEventId));

  useEffect(() => {
    if (!activeSpotIsVisible || !activeEventIsVisible) {
      clearActivePins();
    }
  }, [activeEventIsVisible, activeSpotIsVisible, clearActivePins]);

  const viewportPoints = useMemo(
    () =>
      deriveMapViewportPoints(spotView.spots, filteredEvents, enabledLayers),
    [enabledLayers, filteredEvents, spotView.spots],
  );
  const layerKey = useMemo(
    () => Array.from(enabledLayers).join(","),
    [enabledLayers],
  );
  // When a city is selected, city recentering is handled with a stable focus zoom
  // by LeafletCanvas's city controller; suppress generic mode auto-fitting so
  // background arrival of radius spots does not re-fit or change zoom.
  const handleFitBoundsToVisibleItems = useCallback(() => {
    if (city) return;
    fitBoundsToVisibleItems();
  }, [city, fitBoundsToVisibleItems]);

  // Deep-link focus must not be overridden by the generic mode auto-fit.
  useMapModeEffects({
    mode: requestedMode,
    isAuthenticated: user !== null,
    status,
    location: userLatLon,
    radiusMiles,
    sourceSpots,
    countrySpots,
    activePinId,
    hasRegionFilter,
    region,
    country,
    city,
    layerKey,
    setRadiusMiles,
    setActivePin,
    dismissSaved,
    fitRadius,
    fitBoundsToVisibleItems: handleFitBoundsToVisibleItems,
    hasFocus,
    citySpots,
  });

  // Focus takes absolute precedence for the initial viewport — shared link
  // must centre on the tapped spot, not on viewportPoints[0] order.
  const FOCUS_ZOOM = 13;
  const cityFocusCenter = useMemo<[number, number] | null>(() => {
    if (!city) return null;
    if (cityCentroid) return [cityCentroid.lat, cityCentroid.lon];
    const firstCitySpot =
      citySpots[0] ?? filteredSpots.find((s) => s.citySlug === city);
    if (firstCitySpot) {
      return [firstCitySpot.location.lat, firstCitySpot.location.lon];
    }
    const firstCityEvent = filteredEvents.find((e) => e.citySlug === city);
    if (firstCityEvent) {
      return [firstCityEvent.lat, firstCityEvent.lon];
    }
    if (viewportPoints[0]) return viewportPoints[0];
    return null;
  }, [city, cityCentroid, citySpots, filteredEvents, filteredSpots, viewportPoints]);

  const initialCenter: [number, number] = hasFocus
    ? [focusedSpot!.location.lat, focusedSpot!.location.lon]
    : nearYou && userLatLon
      ? [userLatLon.lat, userLatLon.lon]
      : cityFocusCenter
        ? cityFocusCenter
        : viewportPoints[0]
          ? viewportPoints[0]
          : [20, 0];
  const initialZoom = hasFocus
    ? FOCUS_ZOOM
    : nearYou
      ? NEAR_YOU_INITIAL_ZOOM
      : city !== null
        ? FOCUS_ZOOM
        : 2;

  // When the map's viewport controller is ready, centre it on the focused
  // spot and reveal its popup. Separate from initialCenter so client-side
  // param changes (e.g. navigating spot-to-spot) also re-fly.
  useEffect(() => {
    if (!hasFocus || !focusedSpot) return;
    // Ensure the pin exists in the current filtered view — if the country
    // slug was tampered and filtered it out, still show the spot itself
    // by not clearing it as "invisible".
    setActivePin(focusedSpot.id);
    flyToSpot(focusedSpot);
  }, [focusedSpot, hasFocus, setActivePin, flyToSpot]);

  // Minimalist feedback: when Events layer is on but the current region+country has zero events,
  // surface a single info toast per selection (deduped by region::country).
  const prevZeroToastKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (baseNeeds || willRestore || hasFocus) return;
    if (!enabledLayers.has("events")) return;
    if (eventsDegraded) return;
    if (filteredEvents.length !== 0) {
      prevZeroToastKeyRef.current = null;
      return;
    }
    if (country === null) return;
    const key = `${region ?? ""}::${country}::${city ?? ""}::0`;
    if (prevZeroToastKeyRef.current === key) return;
    prevZeroToastKeyRef.current = key;
    showToast(`No events in ${country} yet — showing spots only.`, "info");
  }, [
    baseNeeds,
    willRestore,
    hasFocus,
    enabledLayers,
    eventsDegraded,
    filteredEvents.length,
    region,
    country,
    city,
  ]);

  return (
    <section
      id="map-tab"
      role="region"
      aria-labelledby="map-tab-title"
      className="relative flex h-full min-h-0 flex-col animate-fade-in lg:flex-row"
    >
      <h1 id="map-tab-title" className="visually-hidden">
        Spot Map
      </h1>

      <div
        id="map-canvas-container"
        role="region"
        aria-label="Interactive spot map"
        aria-describedby="map-keyboard-help"
        className="relative isolate flex flex-1 flex-col overflow-hidden bg-surface-container-low"
      >
        <p id="map-keyboard-help" className="visually-hidden">
          Use the spot list to browse and select spots without interacting with
          the map. Map markers and clusters can also be focused and activated
          with Enter or Space. Leaflet controls support standard keyboard
          navigation.
        </p>
        {!baseNeeds && <MapControls />}

        {/* Stacked status banners: gate (status), nearby (status), degraded (alert) */}
        <div className="pointer-events-none absolute left-3 right-3 top-30 z-[1120] flex flex-col gap-2 sm:right-auto sm:max-w-lg">
          {needsFilteredGeoSelection && (
            <div
              role="status"
              aria-live="polite"
              className={`${MAP_NOTICE_CLASS} flex-col sm:flex-row sm:items-center sm:justify-between`}
            >
              <div className="flex min-w-0 items-start gap-2">
                <span
                  aria-hidden="true"
                  className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary"
                />
                <div className="min-w-0">
                  <p className={MAP_NOTICE_TITLE_CLASS}>
                    Region &amp; country required
                  </p>
                  <p className={`mt-1 ${MAP_NOTICE_BODY_CLASS}`}>
                    Filtered mode needs both a region and a country. Choose your
                    area to load the map. You can also switch to Nearby or
                    Saved.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => useUIStore.getState().openSearch()}
                className={MAP_ACTION_PRIMARY_CLASS}
              >
                Choose area
              </button>
            </div>
          )}

          {!baseNeeds && nearbyNeedsLocation && (
            <>
              {status === "denied" ? (
                <div className="pointer-events-auto">
                  <LocationBlockedCallout
                    variant="banner"
                    onRetry={() => void requestLocation()}
                    className="!border-outline-variant !bg-surface/95"
                  />
                </div>
              ) : (
                <div
                  role="status"
                  aria-live="polite"
                  className={MAP_NOTICE_ROW_CLASS}
                >
                  <div className="flex min-w-0 items-start gap-2">
                    <span
                      aria-hidden="true"
                      className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary"
                    />
                    <p className={`min-w-0 ${MAP_NOTICE_BODY_CLASS}`}>
                      {nearbyNoticeMessage(status, error)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void requestLocation()}
                    disabled={status === "requesting"}
                    className={`${MAP_ACTION_PRIMARY_CLASS} disabled:cursor-wait disabled:opacity-60`}
                  >
                    {nearbyNoticeActionLabel(status)}
                  </button>
                </div>
              )}
            </>
          )}

          {!baseNeeds &&
            requestedMode === "saved" &&
            (user === null ? (
              <div
                role="status"
                aria-live="polite"
                className={MAP_NOTICE_ROW_CLASS}
              >
                <div className="flex min-w-0 items-start gap-2">
                  <span
                    aria-hidden="true"
                    className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary"
                  />
                  <div className="min-w-0">
                    <p className={MAP_NOTICE_TITLE_CLASS}>
                      Sign in to view saved spots
                    </p>
                    <p className={`mt-1 ${MAP_NOTICE_BODY_CLASS}`}>
                      Your saved skate spots sync across devices when you're
                      signed in.
                    </p>
                  </div>
                </div>
                <SignInLink
                  variant="header"
                  className="min-h-12 shrink-0 whitespace-nowrap !rounded-lg !border-2 !border-primary !bg-primary !px-4 !py-0 !text-sm !tracking-[0.04em] !text-on-primary hover:!bg-primary/90 active:translate-y-px"
                />
              </div>
            ) : spotView.spots.length === 0 ? (
              <div
                role="status"
                aria-live="polite"
                className={MAP_NOTICE_ROW_CLASS}
              >
                <div className="flex min-w-0 items-start gap-2">
                  <span
                    aria-hidden="true"
                    className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary"
                  />
                  <div className="min-w-0">
                    <p className={MAP_NOTICE_TITLE_CLASS}>No saved spots yet</p>
                    <p className={`mt-1 ${MAP_NOTICE_BODY_CLASS}`}>
                      Save spots while browsing the map or exploring spots to
                      quickly access them here.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={dismissSaved}
                  className={MAP_ACTION_PRIMARY_CLASS}
                >
                  Explore map
                </button>
              </div>
            ) : null)}

          {(spotsDegraded || eventsDegraded) && (
            <div role="alert" className={MAP_NOTICE_ROW_CLASS}>
              <div className="flex min-w-0 items-start gap-2">
                <span
                  aria-hidden="true"
                  className="mt-1 h-2 w-2 shrink-0 rounded-full bg-error"
                />
                <div className="min-w-0">
                  <p className={MAP_NOTICE_TITLE_CLASS}>Map data limited</p>
                  <ul className={`mt-1 space-y-0.5 ${MAP_NOTICE_BODY_CLASS}`}>
                    {spotsDegraded && (
                      <li>Spot data is temporarily unavailable.</li>
                    )}
                    {eventsDegraded && (
                      <li>Event data is temporarily unavailable.</li>
                    )}
                  </ul>
                </div>
              </div>
              <button
                type="button"
                onClick={() => router.refresh()}
                className={`${MAP_ACTION_BASE_CLASS} border-outline-variant hover:bg-surface-container`}
              >
                Try again
              </button>
            </div>
          )}
        </div>

        {willRestore ? (
          <div
            role="status"
            aria-live="polite"
            aria-label="Loading saved map filter"
            className="flex flex-1 flex-col items-center justify-center gap-4 bg-surface-container-low px-6 py-12 text-center "
          >
            <div
              className="h-12 w-12 rounded-[8px] bg-surface-container-high"
              aria-hidden="true"
            />
            <div
              className="h-4 w-32 rounded bg-surface-container-high"
              aria-hidden="true"
            />
            <div
              className="h-3 w-48 rounded bg-surface-container-high"
              aria-hidden="true"
            />
          </div>
        ) : needsFilteredGeoSelection ? (
          <div
            role="region"
            aria-labelledby="map-gate-title"
            aria-describedby="map-gate-desc"
            className="flex flex-1 flex-col items-center justify-center gap-4 bg-surface-container-low px-6 py-12 text-center"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-lg border-2 border-outline-variant bg-surface-container-high text-secondary">
              <span
                aria-hidden="true"
                className="font-display text-xs font-bold"
              >
                !
              </span>
            </div>
            <div className="max-w-sm space-y-2">
              <h2
                id="map-gate-title"
                className="font-display text-2xl font-bold uppercase leading-[1.3] tracking-[-0.02em]"
              >
                Choose region &amp; country
              </h2>
              <p
                id="map-gate-desc"
                className="text-sm font-semibold leading-5 text-secondary"
              >
                Filtered map requires both a region and a country. Open the
                search and pick your area to load spots. Or switch to Nearby or
                Saved above.
              </p>
            </div>
            <button
              type="button"
              onClick={() => useUIStore.getState().openSearch()}
              className={MAP_ACTION_PRIMARY_CLASS}
            >
              Open search
            </button>
          </div>
        ) : (
          <>
            <LeafletCanvas
              spots={spotView.spots}
              events={filteredEvents}
              initialCenter={initialCenter}
              initialZoom={initialZoom}
              disableInitialFit={hasFocus || city !== null}
              selectedCity={city}
              cityCenter={cityFocusCenter}
            />
            <MapInfoPopup events={filteredEvents} />
            {scopeLabel && (
              <div
                className={cn(
                  "pointer-events-none absolute left-3 bottom-8 z-[1120] max-w-[calc(100%-24px)] truncate rounded-lg border-2 border-outline-variant bg-surface/95 px-3 py-2 font-display text-xs font-semibold uppercase tracking-[0.05em] text-secondary",
                  (activePinId !== null || activeEventId !== null) &&
                    "hidden md:block",
                )}
              >
                {scopeLabel}
              </div>
            )}
          </>
        )}

        {cityScopeLoadingActive && (
          <MapCityLoader
            isOpen
            className="absolute inset-0 z-[1150] flex min-h-0 flex-1 flex-col items-center justify-center bg-surface/95 px-6 py-10 backdrop-blur-[2px]"
          />
        )}
      </div>
    </section>
  );
}
