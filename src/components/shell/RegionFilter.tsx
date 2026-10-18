"use client";

import { useMemo } from "react";
import { useSpotsStore } from "@/stores/spots-store";
import type { MapSpot } from "@/lib/types";
import type { MapEvent } from "@/types/sport-events";
import type { CityOption } from "@/hooks/map/useMapFilter";
import {
  mergeCityOptions,
  useCityList,
} from "@/hooks/map/useCityList";
import {
  CityDrillDown,
  CountryDrillDown,
  RegionList,
} from "./region-filter-parts";

interface RegionFilterProps {
  region: string | null;
  country: string | null;
  /** Canonical `citySlug`; `null` shows the "all country spots" scope. */
  city: string | null;
  availableCountries: readonly string[];
  availableCities: readonly CityOption[];
  /**
   * Whether the client-derived city list provably covers the browsed
   * country (the map store's `countrySpots` overlay matches it). When not
   * provable — freshly picked or switched country — the city step fetches
   * server truth instead of presenting the capped directory's sliver.
   */
  cityDatasetComplete: boolean;
  /**
   * Whether the city step (03) is the active drill-down. The parent owns
   * this so the overlay header's step label can mirror the view: country
   * picks advance, the "All countries" back button retreats.
   */
  showCities: boolean;
  hasFilter: boolean;
  setRegion: (name: string | null) => void;
  setCountry: (name: string | null) => void;
  setCity: (slug: string | null) => void;
  clearAll: () => void;
  /** Advance from the country list to the city list (picker mode). */
  onAdvanceToCities?: () => void;
  /** Retreat from the city list to the country list (picker mode). */
  onBackToCountries?: () => void;
  /**
   * Called after a user-initiated action (region/country/city/clear). The
   * parent typically uses this to close the surrounding overlay.
   */
  onAfterChange?: () => void;
  /**
   * When provided, the picker runs in deferred mode: region selection stages
   * locally without closing, exposing the country list for the chosen
   * region, and the country pick advances to the city list. City picks call
   * this to flush the staged selection to the URL (and the parent also
   * closes via `onAfterChange`).
   */
  onCommit?: () => void;
  /**
   * No-cities escape for the city drill-down's empty state: commits the
   * current region+country as a country-wide scope (`scope=country`
   * marker satisfies the mandatory-city gate). The parent also closes via
   * `onAfterChange`.
   */
  onCommitCountryAll?: () => void;
  /** Full spot list, used to compute per-country counts in the drill-down. */
  allSpots?: readonly MapSpot[];
  /** Full event list, used to compute per-country event counts (anticipatory). */
  allEvents?: readonly MapEvent[];
}

export function RegionFilter({
  region,
  country,
  city,
  availableCountries,
  availableCities,
  cityDatasetComplete,
  showCities,
  allSpots = [],
  allEvents = [],
  setRegion,
  setCountry,
  setCity,
  onAdvanceToCities,
  onBackToCountries,
  onAfterChange,
  onCommit,
  onCommitCountryAll,
}: RegionFilterProps) {
  const regions = useSpotsStore((s) => s.regions);
  const isPicker = typeof onCommit === "function";

  // Server-truth city list: fetch only when the client dataset cannot
  // prove completeness for the browsed country (fresh pick, country
  // switch, degraded overlay) — the committed-country path on /map is
  // already complete and makes no request.
  const needsServerCities =
    isPicker && country !== null && !cityDatasetComplete;
  const serverCityList = useCityList(country, needsServerCities);
  const serverCityOptions =
    serverCityList && serverCityList.country === country
      ? serverCityList.cities
      : null;
  const citiesForStep = useMemo(
    () => mergeCityOptions(availableCities, serverCityOptions ?? []),
    [availableCities, serverCityOptions],
  );
  const citiesPending =
    needsServerCities &&
    !(serverCityList?.done && serverCityList.country === country);

  const countryCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const spot of allSpots) {
      map.set(spot.country, (map.get(spot.country) ?? 0) + 1);
    }
    return map;
  }, [allSpots]);

  const eventCountByCountry = useMemo(() => {
    const map = new Map<string, number>();
    for (const event of allEvents) {
      map.set(event.country, (map.get(event.country) ?? 0) + 1);
    }
    return map;
  }, [allEvents]);

  const selectedRegion = useMemo(
    () => regions.find((r) => r.name === region) ?? null,
    [regions, region],
  );

  const handleRegionPick = (name: string) => {
    const next = region === name ? null : name;
    setRegion(next);
    if (!isPicker) onAfterChange?.();
  };

  const handleCountryPick = (name: string) => {
    // Picker mode: the active country row stays clickable — re-clicking it
    // re-enters its city list (navigation) instead of toggling the staged
    // country off, which previously left the row disabled and unreachable.
    if (isPicker && country === name) {
      onAdvanceToCities?.();
      return;
    }
    const next = country === name ? null : name;
    setCountry(next);
    if (isPicker) {
      if (next !== null) onAdvanceToCities?.();
      return;
    }
    onAfterChange?.();
  };

  const handleCityPick = (slug: string) => {
    const next = city === slug ? null : slug;
    setCity(next);
    onCommit?.();
    onAfterChange?.();
  };

  const handleBack = () => {
    setRegion(null);
  };

  // The country-wide "View all" CTA lives only in the city drill-down's
  // empty state (no cities exist or the dataset is degraded): committing a
  // country city-less has no exit otherwise with the mandatory-city gate.
  // It flushes through `onCommitCountryAll` (which stages the escape and
  // writes the `scope=country` marker). The region-level CTA stages
  // nothing: committing a region-only scope is immediately re-blocked by
  // the mandatory gate (forced overlay reopens) — documented quirk.
  const handleViewAll = () => {
    onCommit?.();
    onAfterChange?.();
  };

  const handleCommitCountryAll = () => {
    onCommitCountryAll?.();
    onAfterChange?.();
  };

  if (region && selectedRegion && country && showCities) {
    return (
      <CityDrillDown
        country={country}
        cities={citiesForStep}
        city={city}
        citiesPending={citiesPending}
        isPicker={isPicker}
        onBack={onBackToCountries ?? (() => {})}
        onPick={handleCityPick}
        onCommitCountryAll={handleCommitCountryAll}
      />
    );
  }

  if (region && selectedRegion) {
    return (
      <CountryDrillDown
        region={selectedRegion}
        countries={availableCountries}
        country={country}
        countryCount={countryCount}
        eventCountByCountry={eventCountByCountry}
        isPicker={isPicker}
        onBack={handleBack}
        onPick={handleCountryPick}
        onViewAll={handleViewAll}
      />
    );
  }

  return (
    <RegionList regions={regions} region={region} onPick={handleRegionPick} />
  );
}
