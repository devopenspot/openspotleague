"use client";

import { useMemo } from "react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import {
  readCountryScopeAll,
  requestedMapMode,
  resolveUrlRegionCountry,
  shouldEnforceFilteredGeoGate,
} from "@/components/map/shared/map-mode";
import {
  getLastMapFilter,
  isValidLastFilter,
  lastFilterResolvesGate,
} from "@/lib/map/last-filter";
import type { Region } from "@/lib/types";

interface OptimisticGateResult {
  /** True when UI should show gate banner/placeholder/forced overlay */
  needsGate: boolean;
  /** True when gate would show but localStorage has valid last filter that will restore URL next tick */
  willRestore: boolean;
  /** True when localStorage has valid last filter (region+country) */
  hasValidLast: boolean;
  /** Base gate without localStorage consideration */
  baseNeeds: boolean;
}

/**
 * Optimistic gate: returning users with a fully complete last filter (one
 * that satisfies the region+country+city gate when replayed) should NOT see
 * the "Region, country & city required" gate even before router.replace
 * heals the URL. This eliminates the 1-frame flicker where gate + forced
 * overlay flash before restore. Reads localStorage synchronously
 * (client-only) and validates against current catalog. URL remains
 * canonical; MapPageClient still does the sole router.replace.
 *
 * A valid but *city-less* legacy last filter (or a filter missing the city
 * by design) does NOT suppress the gate: replay restores region+country but
 * leaves the mandatory-city gate standing, so the forced overlay must be
 * there — at the city step — to complete the selection.
 */
export function useOptimisticGate(
  searchParams: ReadonlyURLSearchParams,
  regions: readonly Region[],
  hasFocusOverride?: boolean,
): OptimisticGateResult {
  return useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    const mode = requestedMapMode(params);
    const urlRC = resolveUrlRegionCountry(params, regions);
    const countryScopeAll = readCountryScopeAll(params);
    const hasFocus = hasFocusOverride ?? params.get("spot") !== null;
    const baseNeeds = shouldEnforceFilteredGeoGate(mode, urlRC.region, urlRC.country, urlRC.city, {
      hasFocus,
      countryScopeAll,
    });

    // Client-only: SSR and first hydration have no localStorage / no regions to validate
    if (typeof window === "undefined" || regions.length === 0) {
      return { needsGate: baseNeeds, willRestore: false, hasValidLast: false, baseNeeds };
    }

    let hasValidLast: boolean;
    let lastResolvesGate: boolean;
    try {
      const last = getLastMapFilter();
      hasValidLast = isValidLastFilter(last, regions);
      // Actual gate resolution: the replay must satisfy the city (or the
      // no-cities escape) too.
      lastResolvesGate = lastFilterResolvesGate(last, regions);
    } catch {
      hasValidLast = false;
      lastResolvesGate = false;
    }

    const willRestore =
      baseNeeds && hasValidLast && !hasFocus && mode === "filtered" && urlRC.region === null && urlRC.country === null;

    // Suppress gate visuals only when the restore resolves the whole gate.
    const needsGate = baseNeeds && !lastResolvesGate;

    return { needsGate, willRestore, hasValidLast, baseNeeds };
  }, [searchParams, regions, hasFocusOverride]);
}
