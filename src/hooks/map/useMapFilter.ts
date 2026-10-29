"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, type ReadonlyURLSearchParams } from "next/navigation";
import { useSpotsStore } from "@/stores/spots-store";
import type { MapSpot } from "@/lib/types";
import { slugify } from "@/lib/utils/slug";
import {
  clearLastMapFilter,
  setLastMapFilter,
} from "@/lib/map/last-filter";

export function activateFilteredMapMode(
  params: URLSearchParams,
  hasLocationFilter: boolean,
): URLSearchParams {
  const next = new URLSearchParams(params.toString());
  if (hasLocationFilter) {
    next.delete("nearby");
    next.delete("saved");
  }
  return next;
}

function buildSlugMaps(regions: ReadonlyArray<{ name: string; countries: readonly string[] }>): {
  regionSlugToName: ReadonlyMap<string, string>;
  countrySlugToName: ReadonlyMap<string, string>;
  nameToRegionSlug: ReadonlyMap<string, string>;
  nameToCountrySlug: ReadonlyMap<string, string>;
} {
  const regionSlugToName = new Map<string, string>();
  const nameToRegionSlug = new Map<string, string>();
  const countrySlugToName = new Map<string, string>();
  const nameToCountrySlug = new Map<string, string>();
  for (const r of regions) {
    const rSlug = slugify(r.name);
    regionSlugToName.set(rSlug, r.name);
    nameToRegionSlug.set(r.name, rSlug);
    for (const c of r.countries) {
      const cSlug = slugify(c);
      countrySlugToName.set(cSlug, c);
      nameToCountrySlug.set(c, cSlug);
    }
  }
  return { regionSlugToName, countrySlugToName, nameToRegionSlug, nameToCountrySlug };
}

export interface CityOption {
  /** Canonical `Spot.citySlug` used by the `city` URL param. */
  slug: string;
  /** Display name, taken from the first spot seen for the slug. */
  name: string;
  count: number;
  admin1?: string | null;
  spotCount?: number;
  lat?: number;
  lon?: number;
}

/**
 * One entry per distinct city (grouped by the canonical `citySlug`) within
 * `country`, ordered by spot count (descending), ties alphabetical. Counts
 * are client-derived from the passed spot list — they drive the ordering,
 * not a display — and undercount when the caller passes the page-capped
 * directory, so MapTab/SearchOverlay union `countrySpots` for
 * full-accuracy lists. There is no server-truth city-count upgrade: the
 * list is only as complete as the spot dataset the caller provides.
 */
export function deriveCityOptions(
  spots: readonly MapSpot[],
  country: string | null,
): readonly CityOption[] {
  if (!country) return [];
  const bySlug = new Map<string, CityOption>();
  for (const spot of spots) {
    if (spot.country !== country || !spot.citySlug) continue;
    const existing = bySlug.get(spot.citySlug);
    if (existing) {
      existing.count += 1;
    } else {
      bySlug.set(spot.citySlug, {
        slug: spot.citySlug,
        name: spot.city,
        count: 1,
      });
    }
  }
  return [...bySlug.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  );
}

export interface MapFilter {
  region: string | null;
  country: string | null;
  /** Canonical `citySlug` for the selected city; `null` when no city step pick. */
  city: string | null;
  availableCountries: readonly string[];
  availableCities: readonly CityOption[];
  filteredSpots: readonly MapSpot[];
  hasFilter: boolean;
  setRegion: (name: string | null) => void;
  setCountry: (name: string | null) => void;
  setCity: (slug: string | null) => void;
  clearAll: () => void;
  /**
   * Commit the current region+country as the no-cities country-wide escape
   * (`scope=country` marker satisfies the mandatory-city gate). Only
   * meaningful from the city drill-down's empty state.
   */
  commitCountryAll: () => void;
  /**
   * Flush the pending selection to the URL via the configured `targetPath`.
   * No-op when `defer` is false, or when no pending changes exist.
   */
  commit: () => void;
  /** Discard any pending selection without touching the URL. */
  cancelPending: () => void;
  /** True while a deferred selection is staged but not yet committed. */
  hasPending: boolean;
}

export interface UseMapFilterOptions {
  /**
   * When provided, setters navigate to this path (e.g. "/map") with the new
   * query string instead of updating the current page's URL in place. Uses
   * `router.push` when the current pathname differs from the target (so
   * back-button returns to the origin page) and `router.replace` when already
   * on the target path (no extra history entries).
   */
  targetPath?: string;
  /**
   * When true, setters stage the change in a local `pending` state instead
   * of writing to the URL. Reads (`region`, `country`, `city`,
   * `availableCountries`, `availableCities`, `filteredSpots`) reflect the
   * pending values when present, falling back to the URL otherwise. Call
   * `commit()` to flush pending to the URL, or `cancelPending()` to discard.
   * Default `false` (write through).
   */
  defer?: boolean;
}

interface PendingSelection {
  region: string | null;
  country: string | null;
  city: string | null;
  /**
   * No-cities escape: commit a country-wide scope for a country whose
   * merged city list is empty. Flushed as the URL marker `scope=country`,
   * which the map gate accepts in place of the mandatory city pick (a
   * country with genuinely no cities could otherwise never unlock it).
   */
  countryAll?: boolean;
}

/**
 * Resolve the `city` URL param against the resolved country. The slug is
 * intentionally NOT validated against the client-side spot index: that
 * index is built from `countrySpots`, whose full-country RSC fetch can
 * degrade to empty under the DB deadlines — nulling the slug back then
 * silently showed the country-wide scope instead of the picked city.
 * Server truth owns correctness: the map page fetches the city's spots
 * directly, so a valid slug always shows its pins, and a genuinely
 * unknown slug renders an empty, still-gated view. A city without a
 * resolved country is dropped — city display names are not globally
 * unique, so the slug alone is meaningless.
 */
export function resolveCityParam(
  citySlugParam: string | null | undefined,
  countryFromUrl: string | null,
): string | null {
  return countryFromUrl && citySlugParam ? citySlugParam : null;
}

export function filterSpotsByRegionAndCountry<T extends MapSpot = MapSpot>(
  spots: readonly T[],
  regions: readonly { name: string; countries: readonly string[] }[],
  region: string | null,
  country: string | null,
  citySlug: string | null = null,
): readonly T[] {
  if (!region && !country && !citySlug) return spots.slice();
  // One pass over the catalog replaces the former per-spot `regions.find` scan.
  const countryToRegion = new Map<string, string>();
  for (const r of regions) {
    for (const c of r.countries) {
      countryToRegion.set(c, r.name);
    }
  }
  return spots.filter((spot) => {
    if (region && countryToRegion.get(spot.country) !== region) return false;
    if (country && spot.country !== country) return false;
    if (citySlug && spot.citySlug !== citySlug) return false;
    return true;
  });
}

export function useMapFilter(
  spots: readonly MapSpot[],
  searchParams: ReadonlyURLSearchParams,
  options: UseMapFilterOptions = {},
): MapFilter {
  const router = useRouter();
  const pathname = usePathname();
  const { targetPath, defer = false } = options;
  const regions = useSpotsStore((s) => s.regions);
  const [pending, setPending] = useState<PendingSelection | null>(null);
  const pendingRef = useRef<PendingSelection | null>(null);

  const stage = useCallback((next: PendingSelection | null) => {
    pendingRef.current = next;
    setPending(next);
  }, []);

  const slugs = useMemo(() => buildSlugMaps(regions), [regions]);
  const validRegionNames = useMemo(
    () => new Set(regions.map((r) => r.name)),
    [regions],
  );
  const validCountryNames = useMemo(
    () => new Set(regions.flatMap((r) => r.countries)),
    [regions],
  );

  const regionSlug = searchParams.get("region")?.toLowerCase() ?? null;
  const countrySlug = searchParams.get("country")?.toLowerCase() ?? null;
  const citySlugParam = searchParams.get("city")?.toLowerCase() ?? null;

  const regionFromUrl = regionSlug ? slugs.regionSlugToName.get(regionSlug) ?? null : null;
  const countryFromUrl = countrySlug
    ? slugs.countrySlugToName.get(countrySlug) ?? null
    : null;

  const safeRegionFromUrl =
    regionFromUrl && validRegionNames.has(regionFromUrl) ? regionFromUrl : null;
  const safeCountryFromUrl =
    countryFromUrl && validCountryNames.has(countryFromUrl) ? countryFromUrl : null;
  // City is only meaningful scoped to a resolved country: city display names
  // are not globally unique, so the slug must exist under that country.
  // City is only meaningful scoped to a resolved country. The slug is no
  // longer cross-checked against the client-side city index: that index is
  // built from `countrySpots`, whose full-country RSC fetch can degrade to
  // empty under the DB deadlines — nulling the slug back then silently
  // showed the country-wide scope instead of the picked city. Server truth
  // owns correctness now: the map page fetches the city's spots directly,
  // so a valid slug shows its pins regardless of index state, and a
  // genuinely unknown slug renders an empty, still-gated view.
  const safeCityFromUrl = resolveCityParam(citySlugParam, safeCountryFromUrl);

  const region = defer && pending ? pending.region : safeRegionFromUrl;
  const country = defer && pending ? pending.country : safeCountryFromUrl;
  const city = defer && pending ? pending.city : safeCityFromUrl;

  const availableCountries = useMemo(() => {
    if (!region) {
      return regions.flatMap((r) => r.countries);
    }
    return regions.find((r) => r.name === region)?.countries ?? [];
  }, [region, regions]);

  const availableCities = useMemo(
    () => deriveCityOptions(spots, country),
    [spots, country],
  );

  const writeQuery = useCallback(
    (next: PendingSelection) => {
      const escaped = next.countryAll === true;
      const params = activateFilteredMapMode(
        new URLSearchParams(searchParams.toString()),
        Boolean(next.region || next.country || next.city),
      );
      const regionSlugValue = next.region ? slugs.nameToRegionSlug.get(next.region) ?? null : null;
      const countrySlugValue = next.country
        ? slugs.nameToCountrySlug.get(next.country) ?? null
        : null;
      if (regionSlugValue) params.set("region", regionSlugValue);
      else params.delete("region");
      if (countrySlugValue) params.set("country", countrySlugValue);
      else params.delete("country");
      if (next.city) params.set("city", next.city);
      else params.delete("city");
      // No-cities escape marker: a later commit with a real city (or any
      // staged state without `countryAll`) removes it.
      if (escaped) params.set("scope", "country");
      else params.delete("scope");
      // Persist last complete filter for default on next visit. A picked
      // city is now part of that default (the mandatory-city gate resolves
      // from it); null drops a previously stored city/scope, e.g. the
      // country-wide escape replaced by a new city, or a cleared filter.
      if (next.region && next.country) {
        try {
          setLastMapFilter(next.region, next.country, next.city, escaped);
        } catch {
          void 0;
        }
      } else if (!next.region && !next.country) {
        try {
          clearLastMapFilter();
        } catch {
          void 0;
        }
      }
      const query = params.toString();
      const destination = targetPath ?? pathname;
      const url = query ? `${destination}?${query}` : destination;
      const isCrossPageNavigation =
        typeof targetPath === "string" && targetPath !== pathname;
      // A city-param change re-runs the RSC scope fetch (country walk +
      // city read) before the new data lands; flag it so the map canvas
      // and the search overlay can show the city loading state. Cleared
      // by `MapPageClient` when the fresh payload is mirrored.
      if (next.city !== safeCityFromUrl) {
        useSpotsStore.getState().setCityScopeLoading(true);
      }
      if (isCrossPageNavigation) {
        router.push(url, { scroll: false });
      } else {
        router.replace(url, { scroll: false });
      }
    },
    [pathname, router, searchParams, safeCityFromUrl, slugs, targetPath],
  );

  const setRegion = useCallback(
    (name: string | null) => {
      if (name === null) {
        if (defer) {
          stage({ region: null, country: null, city: null });
          return;
        }
        writeQuery({ region: null, country: null, city: null });
        return;
      }
      if (!validRegionNames.has(name)) return;
      const regionEntry = regions.find((r) => r.name === name);
      const nextCountry =
        country && regionEntry && !regionEntry.countries.includes(country)
          ? null
          : country;
      // City is scoped to the country, so it only survives when the
      // country does.
      const nextCity = nextCountry === country ? city : null;
      if (defer) {
        stage({ region: name, country: nextCountry, city: nextCity });
        return;
      }
      writeQuery({ region: name, country: nextCountry, city: nextCity });
    },
    [city, country, defer, regions, stage, validRegionNames, writeQuery],
  );

  const setCountry = useCallback(
    (name: string | null) => {
      if (name === null) {
        if (defer) {
          stage({ region, country: null, city: null });
          return;
        }
        writeQuery({ region, country: null, city: null });
        return;
      }
      if (!validCountryNames.has(name)) return;
      if (defer) {
        stage({ region, country: name, city: null });
        return;
      }
      writeQuery({ region, country: name, city: null });
    },
    [defer, region, stage, validCountryNames, writeQuery],
  );

  const setCity = useCallback(
    (slug: string | null) => {
      // Trusts the caller for staged picks: the city rows are built from the
      // merged client+server list, which includes cities absent from the
      // URL-derived view. URL params are no longer index-validated in
      // `safeCityFromUrl` — any slug under a resolved country is accepted,
      // so tampered links degrade to an empty (gated) view rather than a
      // silently different scope.
      if (!country || (slug !== null && slug.length === 0)) return;
      if (defer) {
        stage({ region, country, city: slug });
        return;
      }
      writeQuery({ region, country, city: slug });
    },
    [country, defer, region, stage, writeQuery],
  );

  const clearAll = useCallback(() => {
    if (defer) {
      stage({ region: null, country: null, city: null });
      return;
    }
    writeQuery({ region: null, country: null, city: null });
  }, [defer, stage, writeQuery]);

  /**
   * No-cities escape for the city drill-down's empty state: commit the
   * current region+country as a country-wide scope (`scope=country` URL
   * marker). In picker (defer) mode the staged pending is flushed with the
   * marker attached; write-through mode commits directly.
   */
  const commitCountryAll = useCallback(() => {
    if (!region || !country) return;
    const next: PendingSelection = { region, country, city: null, countryAll: true };
    if (defer) {
      stage(next);
      pendingRef.current = next;
      writeQuery(next);
      pendingRef.current = null;
      setPending(null);
      return;
    }
    writeQuery(next);
  }, [country, defer, region, stage, writeQuery]);

  const commit = useCallback(() => {
    if (!defer) return;
    const next = pendingRef.current;
    if (!next) return;
    writeQuery(next);
    pendingRef.current = null;
    setPending(null);
  }, [defer, writeQuery]);

  const cancelPending = useCallback(() => {
    if (!defer) return;
    pendingRef.current = null;
    setPending(null);
  }, [defer]);

  const filteredSpots = useMemo(() => {
    // Catalog-degraded fallback: when regions are empty (DB down) but the
    // URL still carries a country/region slug (e.g. shared deep link),
    // filter directly by slugifying the spot's fields instead of relying
    // on the catalog mapping. This keeps the shared-link country filter
    // functional even when `listRegions()` fell back to [].
    if (regions.length === 0 && (regionSlug || countrySlug)) {
      return spots.filter((spot) => {
        if (countrySlug && slugify(spot.country) !== countrySlug) return false;
        if (citySlugParam && spot.citySlug !== citySlugParam) return false;
        // Region can't be verified without catalog; keep country match.
        return true;
      });
    }
    return filterSpotsByRegionAndCountry(spots, regions, region, country, city);
  }, [spots, regions, region, country, city, regionSlug, countrySlug, citySlugParam]);

  return {
    region,
    country,
    city,
    availableCountries,
    availableCities,
    filteredSpots,
    hasFilter: region !== null || country !== null || city !== null,
    setRegion,
    setCountry,
    setCity,
    clearAll,
    commitCountryAll,
    commit,
    cancelPending,
    hasPending: defer && pending !== null,
  };
}
