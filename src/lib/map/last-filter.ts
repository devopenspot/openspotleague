import { slugify } from "@/lib/utils/slug";
import type { Region } from "@/lib/types";

export const LAST_MAP_FILTER_KEY = "openspot-last-map-filter";

export interface LastMapFilter {
  region: string;
  country: string;
  regionSlug: string;
  countrySlug: string;
  /**
   * Picked `city` URL slug (optional). Legacy payloads (written before the
   * mandatory-city gate) restore without it: the restored region+country
   * then re-opens the forced overlay for one city pick, which re-persists
   * the field. Empty/absent = no city staged.
   */
  city?: string;
  citySlug?: string;
  /**
   * Country-wide escape marker for countries with genuinely no cities —
   * mirrors the URL's `scope=country` so returning users are not re-gated.
   */
  countryScopeAll?: boolean;
  updatedAt: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isClient(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function optionalString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function getLastMapFilter(): LastMapFilter | null {
  if (!isClient()) return null;
  try {
    const raw = localStorage.getItem(LAST_MAP_FILTER_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    const region = optionalString(parsed.region);
    const country = optionalString(parsed.country);
    const regionSlug = optionalString(parsed.regionSlug);
    const countrySlug = optionalString(parsed.countrySlug);
    const updatedAt = typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now();
    if (!region || !country || !regionSlug || !countrySlug) return null;
    return {
      region,
      country,
      regionSlug,
      countrySlug,
      city: optionalString(parsed.city),
      citySlug: optionalString(parsed.citySlug),
      countryScopeAll: parsed.countryScopeAll === true,
      updatedAt,
    };
  } catch {
    return null;
  }
}

/**
 * Persist the region+country default and, when present, the picked city
 * (`city` is the canonical `citySlug` the URL param carries — callers don't
 * hold a separate display name) or the no-cities country-wide escape. Null
 * city drops a previously stored city so stale state never restores across
 * an intentional country-wide scope.
 */
export function setLastMapFilter(
  region: string,
  country: string,
  city: string | null = null,
  countryScopeAll = false,
): void {
  if (!isClient()) return;
  try {
    const regionSlug = slugify(region);
    const countrySlug = slugify(country);
    if (!regionSlug || !countrySlug) return;
    const citySlug = city ? slugify(city) : "";
    const payload: LastMapFilter = {
      region,
      country,
      regionSlug,
      countrySlug,
      ...(citySlug ? { city: citySlug, citySlug } : {}),
      ...(countryScopeAll ? { countryScopeAll: true } : {}),
      updatedAt: Date.now(),
    };
    localStorage.setItem(LAST_MAP_FILTER_KEY, JSON.stringify(payload));
  } catch {
    // ignore private-mode quota errors
    void 0;
  }
}

export function clearLastMapFilter(): void {
  if (!isClient()) return;
  try {
    localStorage.removeItem(LAST_MAP_FILTER_KEY);
  } catch {
    void 0;
  }
}

export function isValidLastFilter(
  filter: LastMapFilter | null,
  regions: readonly Region[],
): boolean {
  if (!filter) return false;
  if (!filter.region || !filter.country) return false;
  if (regions.length === 0) {
    // Degraded catalog: any non-empty slugs counts as valid (shared-link lenient)
    return Boolean(filter.regionSlug && filter.countrySlug);
  }
  const validRegionNames = new Set(regions.map((r) => r.name));
  const validCountryNames = new Set(regions.flatMap((r) => r.countries));
  if (!validRegionNames.has(filter.region)) return false;
  if (!validCountryNames.has(filter.country)) return false;
  const regionEntry = regions.find((r) => r.name === filter.region);
  if (!regionEntry) return false;
  if (!regionEntry.countries.includes(filter.country)) return false;
  // slugs must also match current slugify output (handles diacritic/rename)
  if (slugify(filter.region) !== filter.regionSlug) return false;
  if (slugify(filter.country) !== filter.countrySlug) return false;
  return true;
}

/**
 * Whether a *fully complete* last filter exists: one that would satisfy the
 * region+country+city gate when replayed (or the no-cities escape). A valid
 * but city-less legacy payload restores region+country and then leaves the
 * gate standing for one forced city pick — replaying it must not suppress
 * the gate visuals, or the map would sit hidden-spots with no overlay open.
 */
export function lastFilterResolvesGate(
  filter: LastMapFilter | null,
  regions: readonly Region[],
): boolean {
  if (!isValidLastFilter(filter, regions)) return false;
  return Boolean(filter?.citySlug || filter?.countryScopeAll);
}
