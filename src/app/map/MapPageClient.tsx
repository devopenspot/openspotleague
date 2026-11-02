'use client';

import { Suspense, useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import MapTab from '@/components/map/layout/MapTab';
import {
  normalizeMapModeParams,
  readCountryScopeAll,
  requestedMapMode,
  resolveUrlRegionCountry,
  shouldEnforceFilteredGeoGate,
} from '@/components/map/shared/map-mode';
import { useMapStore } from '@/stores/map-store';
import { useUserLocationStore } from '@/stores/user-location-store';
import { consumeMapPreserveLocation, consumeMapPreserveNearbyEntry } from '@/lib/map/preserve';
import {
  clearLastMapFilter,
  getLastMapFilter,
  isValidLastFilter,
  setLastMapFilter,
} from '@/lib/map/last-filter';
import { useSpotsStore } from '@/stores/spots-store';
import { deriveScopeCitySpots } from '@/components/map/shared/map-derived';
import { useLayoutEffect } from 'react';
import type { MapSpot } from '@/lib/types';

export function MapPageClient({
  countrySpots = [],
  citySpots = [],
  scopeDegraded = false,
}: {
  countrySpots?: readonly MapSpot[];
  citySpots?: readonly MapSpot[];
  scopeDegraded?: boolean;
}) {
  return (
    <Suspense fallback={null}>
      <MapPageInner
        countrySpots={countrySpots}
        citySpots={citySpots}
        scopeDegraded={scopeDegraded}
      />
    </Suspense>
  );
}

function MapPageInner({
  countrySpots = [],
  citySpots = [],
  scopeDegraded = false,
}: {
  countrySpots?: readonly MapSpot[];
  citySpots?: readonly MapSpot[];
  scopeDegraded?: boolean;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const regions = useSpotsStore((s) => s.regions);
  const setCountrySpots = useSpotsStore((s) => s.setCountrySpots);
  const setCitySpots = useSpotsStore((s) => s.setCitySpots);
  const setCityScopeLoading = useSpotsStore((s) => s.setCityScopeLoading);
  const cityParam = searchParams.get('city');

  // Mirror the server-fetched country and city lists into the store
  // before paint so MapInfoPopup / useWeatherVerification can resolve and
  // mutate spots that live outside the SPOT_LIST_HARD_CAP base directory.
  // When `countrySpots` succeeded on the server, `citySpots` is omitted
  // from the wire (`[]`) and derived client-side via `deriveScopeCitySpots`.
  useLayoutEffect(() => {
    setCountrySpots(countrySpots);
    setCitySpots(deriveScopeCitySpots(countrySpots, citySpots, cityParam));
    setCityScopeLoading(false);
  }, [cityParam, citySpots, countrySpots, setCityScopeLoading, setCitySpots, setCountrySpots]);

  const hasConflictingModes =
    searchParams.get('nearby') === '1' && searchParams.get('saved') === '1';
  const hasRunResetRef = useRef(false);
  const hasRunRestoreRef = useRef(false);
  const wasPreservedRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (!hasConflictingModes) return;
    const normalized = normalizeMapModeParams(searchParams);
    const query = normalized.toString();
    router.replace(query ? `/map?${query}` : '/map', { scroll: false });
  }, [hasConflictingModes, router, searchParams]);

  // Mandatory business rule: distance and weather toggles are OFF by default
  // on open/reload, with no data fetches. Exception: landing from Nearby button
  // preserves distance (keeps location + ?nearby=1 and its data); weather stays OFF.
  // Runs once per /map entry, pathname-aware.
  useEffect(() => {
    if (pathname !== "/map") return;
    if (hasRunResetRef.current) return;
    hasRunResetRef.current = true;

    // Consume preserve flags first — even for hasFocus, to avoid stale preservation
    const isPreserved = consumeMapPreserveLocation();
    const isNearbyEntry = consumeMapPreserveNearbyEntry();
    wasPreservedRef.current = isPreserved;
    if (isPreserved) return;
    if (searchParams.get("spot")) return;

    // Reset weather toggle — always, including Nearby entry
    useMapStore.getState().setWeatherEnabled(false);
    useMapStore.getState().setWeatherFetching(false);

    // Distance toggle: skip when this entry came from the Nearby button
    const hadNearby = searchParams.get("nearby") === "1";
    const isNearbyLanding = isNearbyEntry && hadNearby;
    if (isNearbyLanding) return;

    const hadLocation =
      useUserLocationStore.getState().status !== "idle" ||
      useUserLocationStore.getState().location !== null;
    if (hadLocation || hadNearby) {
      useUserLocationStore.getState().clear();
    }
    if (hadNearby) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("nearby");
      const query = params.toString();
      router.replace(query ? `/map?${query}` : "/map", { scroll: false });
    }
  }, [pathname, router, searchParams]);

  // Persisted default: restore last region/country as default when gate would block.
  // Runs once per /map entry, after regions hydration, only for filtered mode with
  // no explicit region/country, no hasFocus, and no preserve. Respects share-links.
  useEffect(() => {
    if (pathname !== "/map") return;
    if (hasRunRestoreRef.current) return;
    if (regions.length === 0) return;
    // Respect preserve/hasFocus already consumed by reset effect — if reset was skipped due to preserve/hasFocus, skip restore too
    if (wasPreservedRef.current === true) return;
    if (wasPreservedRef.current === null) {
      // Reset effect hasn't run yet (rare due to regions wait), check preserve directly without consuming twice
      // Peek by trying to consume then restore if needed? We already have hasRunResetRef guard.
      // If reset hasn't run, we can't know preserve yet — wait one tick by not marking hasRunRestore
      if (!hasRunResetRef.current) return;
    }
    if (searchParams.get("spot")) return;
    const params = new URLSearchParams(searchParams.toString());
    const mode = requestedMapMode(params);
    if (mode !== "filtered") return;
    const urlRC = resolveUrlRegionCountry(params, regions);
    const countryScopeAll = readCountryScopeAll(params);
    if (
      !shouldEnforceFilteredGeoGate(mode, urlRC.region, urlRC.country, urlRC.city, {
        hasFocus: false,
        countryScopeAll,
      })
    ) {
      // Already has valid filter — remember the full scope as last default
      // (e.g. share-link): region+country plus picked city or the no-cities
      // country-wide escape.
      if (urlRC.region && urlRC.country) {
        try {
          // Only remember when both are present and valid (not degraded slugs)
          if (regions.length > 0) setLastMapFilter(urlRC.region, urlRC.country, urlRC.city, countryScopeAll);
        } catch {
          void 0;
        }
      }
      return;
    }
    if (urlRC.region !== null || urlRC.country !== null) return;
    const last = getLastMapFilter();
    if (!last) {
      hasRunRestoreRef.current = true;
      return;
    }
    if (!isValidLastFilter(last, regions)) {
      try {
        clearLastMapFilter();
      } catch {
        void 0;
      }
      hasRunRestoreRef.current = true;
      return;
    }
    hasRunRestoreRef.current = true;
    const next = new URLSearchParams(params.toString());
    next.set("region", last.regionSlug);
    next.set("country", last.countrySlug);
    // A fully complete last filter (picked city or the no-cities country-wide
    // escape) resolves the mandatory-city gate on replay; city-less legacy
    // payloads restore region+country only and leave the gate standing at
    // the city step (one forced pick re-persists the field).
    if (last.citySlug) next.set("city", last.citySlug);
    if (last.countryScopeAll) next.set("scope", "country");
    if (next.get("nearby") === "1" || next.get("saved") === "1") {
      next.delete("nearby");
      next.delete("saved");
    }
    const query = next.toString();
    router.replace(query ? `/map?${query}` : "/map", { scroll: false });
  }, [pathname, regions, router, searchParams]);

  return (
    <MapTab searchParams={searchParams} scopeDegraded={scopeDegraded} />
  );
}
