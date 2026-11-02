import { Suspense } from "react";
import { withSafeDefault, withSafeDefaultResult } from "@/lib/utils/safe-fetch";
import { listRegions } from "@/lib/services/spot/regions";
import { listSpotsForMapScope } from "@/lib/services/spot/map-country";
import { findSpotById } from "@/lib/services/spot/spots";
import {
  normalizeMapModeParams,
  requestedMapMode,
  resolveUrlRegionCountry,
} from "@/components/map/shared/map-mode";
import type { MapSpot, Region } from "@/lib/types";
import { MapPageClient } from './MapPageClient';

export const metadata = {
  title: 'Spot Map',
  description:
    'Browse the global skate grid. Filter by region or country, find ledges, plazas, bowls, and DIYs.',
};

type RawSearchParams = Record<string, string | string[] | undefined>;

interface CountryScope {
  countrySpots: readonly MapSpot[];
  citySpots: readonly MapSpot[];
  /** A catalog or scope read failed, so an empty result is not a real "no spots". */
  degraded: boolean;
}

const EMPTY_SCOPE: CountryScope = {
  countrySpots: [],
  citySpots: [],
  degraded: false,
};
const EMPTY_REGIONS: readonly Region[] = [];

/**
 * The hydrated client directory is capped at `SPOT_LIST_HARD_CAP` (500)
 * spots, so a country filter would show a sliver of its real contents
 * (e.g. 1 of Colombia's 163). The page has `searchParams` (the layout
 * doesn't), so it resolves the region/country/city slugs server-side and
 * fetches the full public lists to hand to `MapTab` as `countrySpots`
 * (+ `citySpots` fallback when a city is selected and the country walk
 * degrades).
 *
 * Country and city fetches run in parallel: the country walk spans up to
 * 20 sequential pages and can degrade to empty under the 8s/15s DB
 * deadlines, so the city list — a fast single-page read — guarantees the
 * selected city's pins even when the country list fails. When
 * `countrySpots` succeeds (`countrySpots.length > 0`), `citySpots` is a
 * strict subset (`citySpots ⊂ countrySpots`) and is omitted from the
 * flight payload (`citySpots: []`) because `MapPageClient` derives it
 * client-side via `deriveScopeCitySpots`. Nearby/saved modes override
 * the geographic filter — skip both fetches.
 */
async function loadCountryScope(
  params: URLSearchParams,
): Promise<CountryScope> {
  const mode = requestedMapMode(normalizeMapModeParams(params));
  if (mode !== "filtered") return EMPTY_SCOPE;

  const { value: regions, degraded: regionsDegraded } =
    await withSafeDefaultResult(
      () => listRegions(),
      EMPTY_REGIONS,
      "map-page.listRegions",
    );
  if (regions.length === 0) {
    return { ...EMPTY_SCOPE, degraded: regionsDegraded };
  }
  const { country } = resolveUrlRegionCountry(params, regions);
  if (!country) return EMPTY_SCOPE;
  const citySlug = params.get("city")?.toLowerCase() ?? null;
  const spotId = params.get("spot");

  // When a city is specified, fetch ONLY the city's spots:
  // fast single-page read (<200ms) that prevents edge timeouts.
  if (citySlug) {
    const { value: citySpots, degraded } = await withSafeDefaultResult(
      () => listSpotsForMapScope(country, citySlug),
      EMPTY_SCOPE.citySpots,
      "map-page.listSpotsForMapScope.city",
    );
    if (spotId && !citySpots.some((s) => s.id === spotId)) {
      const spot = await withSafeDefault(
        () => findSpotById(spotId),
        null,
        "map-page.findSpotById",
      );
      if (spot) {
        return {
          countrySpots: EMPTY_SCOPE.countrySpots,
          citySpots: [spot, ...citySpots],
          degraded,
        };
      }
    }
    return {
      countrySpots: EMPTY_SCOPE.countrySpots,
      citySpots,
      degraded,
    };
  }

  // If a spot is focused without a city, fetch only that spot for fast loading
  if (spotId) {
    const spot = await withSafeDefault(
      () => findSpotById(spotId),
      null,
      "map-page.findSpotById",
    );
    if (spot) {
      return {
        countrySpots: [spot],
        citySpots: EMPTY_SCOPE.citySpots,
        degraded: false,
      };
    }
  }

  const { value: countrySpots, degraded } = await withSafeDefaultResult(
    () => listSpotsForMapScope(country),
    EMPTY_SCOPE.countrySpots,
    "map-page.listSpotsForMapScope",
  );
  return {
    countrySpots,
    citySpots: EMPTY_SCOPE.citySpots,
    degraded,
  };
}

function toQueryString(raw: RawSearchParams): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else {
      params.set(key, value);
    }
  }
  return params.toString();
}

async function MapCountryScope({ query }: { query: Promise<string> }) {
  const { countrySpots, citySpots, degraded } = await loadCountryScope(
    new URLSearchParams(await query),
  );
  return (
    <MapPageClient
      countrySpots={countrySpots}
      citySpots={citySpots}
      scopeDegraded={degraded}
    />
  );
}

export default function MapPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  // Never pass the framework's `searchParams` proxy to a child as a prop. In
  // dev, React serializes the props of the component calling a "use cache"
  // function, which reads the proxy inside the cache scope and makes that
  // cached call throw. Pass a plain derived value instead.
  return (
    <Suspense fallback={null}>
      <MapCountryScope query={searchParams.then(toQueryString)} />
    </Suspense>
  );
}
