import { slugify } from "@/lib/utils/slug";

export type RequestedMapMode = "nearby" | "saved" | "filtered";

export function normalizeMapModeParams(params: URLSearchParams): URLSearchParams {
  const normalized = new URLSearchParams(params.toString());

  // Saved mode wins if an external link contains both mode flags. The mode
  // controls already emit mutually exclusive URLs, but incoming URLs must be
  // canonical too so the sidebar and viewport cannot disagree.
  if (normalized.get("saved") === "1" && normalized.get("nearby") === "1") {
    normalized.delete("nearby");
  }

  return normalized;
}

export function requestedMapMode(params: URLSearchParams): RequestedMapMode {
  if (params.get("saved") === "1") return "saved";
  if (params.get("nearby") === "1") return "nearby";
  return "filtered";
}

/**
 * Resolve region/country names from URL slugs, mirroring `useMapFilter` validation.
 * Returns strict `null` when slug is missing or not in catalog; when catalog is empty
 * (DB degraded) treats any non-empty slug as present to keep shared-link gating lenient.
 * The `city` slug resolves only when the country resolved — its validity is owned by
 * server truth (the map page fetches the city's spots directly), never the client index.
 */
export function resolveUrlRegionCountry(
  params: URLSearchParams,
  regions: ReadonlyArray<{ name: string; countries: readonly string[] }>,
): {
  region: string | null;
  country: string | null;
  city: string | null;
} {
  const regionSlug = params.get("region")?.toLowerCase() ?? null;
  const countrySlug = params.get("country")?.toLowerCase() ?? null;
  const citySlug = params.get("city")?.toLowerCase() ?? null;
  if (regions.length === 0) {
    // Degraded catalog: any slug counts as selection so the map can still load via fallback
    // filtering in `useMapFilter`. Require both slugs for gate completeness.
    const region = regionSlug && regionSlug.length > 0 ? regionSlug : null;
    const country = countrySlug && countrySlug.length > 0 ? countrySlug : null;
    return {
      region,
      country,
      city: resolveCityScope(citySlug, country),
    };
  }
  // Build maps as in `useMapFilter.buildSlugMaps` (slugify is single source)
  const regionSlugToName = new Map<string, string>();
  const countrySlugToName = new Map<string, string>();
  const validRegionNames = new Set<string>();
  const validCountryNames = new Set<string>();
  for (const r of regions) {
    const rSlug = slugify(r.name);
    regionSlugToName.set(rSlug, r.name);
    validRegionNames.add(r.name);
    for (const c of r.countries) {
      const cSlug = slugify(c);
      countrySlugToName.set(cSlug, c);
      validCountryNames.add(c);
    }
  }
  const regionFromUrl = regionSlug ? regionSlugToName.get(regionSlug) ?? null : null;
  const countryFromUrl = countrySlug ? countrySlugToName.get(countrySlug) ?? null : null;
  const safeRegion = regionFromUrl && validRegionNames.has(regionFromUrl) ? regionFromUrl : null;
  const safeCountry = countryFromUrl && validCountryNames.has(countryFromUrl) ? countryFromUrl : null;
  // When slug present but not in map (tampered), treat as null (gate enforced)
  return {
    region: safeRegion,
    country: safeCountry,
    city: resolveCityScope(citySlug, safeCountry),
  };
}

/**
 * The `city` slug is only meaningful scoped to a resolved country (city
 * display names are not globally unique). Explicit explicit-empty markers
 * are ignored; a non-empty slug under a resolved country is accepted as-is.
 */
function resolveCityScope(
  citySlug: string | null,
  country: string | null,
): string | null {
  return country && citySlug ? citySlug : null;
}

/**
 * Filtered mode is valid only when region, country AND a city are selected,
 * or when the URL carries the explicit country-wide escape marker (`scope=country`,
 * set by the city drill-down's no-cities escape — a country with genuinely no
 * cities cannot satisfy a mandatory city pick). Enforces the mandatory business
 * rule: the map must not load in filtered mode until the user has picked a
 * region+country pair and a city (or taken the no-cities escape).
 */
export const COUNTRY_SCOPE_ALL_PARAM = "scope";
export const COUNTRY_SCOPE_ALL_VALUE = "country";

export function readCountryScopeAll(params: URLSearchParams): boolean {
  const scope = params.get(COUNTRY_SCOPE_ALL_PARAM)?.toLowerCase() ?? null;
  return scope === COUNTRY_SCOPE_ALL_VALUE;
}

export function isFilteredModeComplete(
  region: string | null,
  country: string | null,
  city: string | null,
  countryScopeAll = false,
): boolean {
  if (region === null || country === null) return false;
  return city !== null || countryScopeAll;
}

export function shouldEnforceFilteredGeoGate(
  mode: RequestedMapMode,
  region: string | null,
  country: string | null,
  city: string | null,
  opts: { hasFocus?: boolean; countryScopeAll?: boolean } = {},
): boolean {
  if (opts.hasFocus) return false;
  if (mode !== "filtered") return false;
  return !isFilteredModeComplete(region, country, city, opts.countryScopeAll ?? false);
}

/**
 * Whether the gate-forced search overlay should close because the user
 * left the filtered gate by switching map mode (Nearby/Saved) instead
 * of completing a region+country selection. The overlay's forced state
 * is scoped to the active gate (`shouldEnforceFilteredGeoGate`), so a
 * mode switch that resolves the gate must not strand the overlay on
 * top of the map it was opened for. Filtered-mode gate resolution
 * (region+country commit from the overlay) already closes the overlay
 * itself and must not double-close here.
 */
export function shouldCloseGateSearch(
  wasGate: boolean,
  gate: boolean,
  mode: RequestedMapMode,
): boolean {
  return wasGate && !gate && mode !== "filtered";
}
