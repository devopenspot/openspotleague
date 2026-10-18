import { Suspense } from "react";
import { withSafeDefault } from "@/lib/utils/safe-fetch";
import { listRegions } from "@/lib/services/spot/regions";
import { listSpotsForMapScope } from "@/lib/services/spot/map-country";
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
}

const EMPTY_SCOPE: CountryScope = { countrySpots: [], citySpots: [] };
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
  if (params.get("spot")) return EMPTY_SCOPE;
  if (mode !== "filtered") return EMPTY_SCOPE;

  const regions = await withSafeDefault(
    () => listRegions(),
    EMPTY_REGIONS,
    "map-page.listRegions",
  );
  if (regions.length === 0) return EMPTY_SCOPE;
  const { country } = resolveUrlRegionCountry(params, regions);
  if (!country) return EMPTY_SCOPE;
  const citySlug = params.get("city")?.toLowerCase() ?? null;

  const [countrySpots, citySpots] = await Promise.all([
    withSafeDefault(
      () => listSpotsForMapScope(country),
      EMPTY_SCOPE.countrySpots,
      "map-page.listSpotsForMapScope",
    ),
    citySlug
      ? withSafeDefault(
          () => listSpotsForMapScope(country, citySlug),
          EMPTY_SCOPE.citySpots,
          "map-page.listSpotsForMapScope.city",
        )
      : Promise.resolve(EMPTY_SCOPE.citySpots),
  ]);
  return {
    countrySpots,
    citySpots: countrySpots.length > 0 ? EMPTY_SCOPE.citySpots : citySpots,
  };
}

async function MapCountryScope({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else {
      params.set(key, value);
    }
  }
  const { countrySpots, citySpots } = await loadCountryScope(params);
  return <MapPageClient countrySpots={countrySpots} citySpots={citySpots} />;
}

export default function MapPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return (
    <Suspense fallback={null}>
      <MapCountryScope searchParams={searchParams} />
    </Suspense>
  );
}
