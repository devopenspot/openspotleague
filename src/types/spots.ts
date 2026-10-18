import type { SportDiscipline } from "@/types/sport-events";

export type WeatherIconName =
  | "sunny"
  | "partly_cloudy_day"
  | "cloudy"
  | "rain"
  | "snow";

/**
 * Canonical identifier for a spot category. The set of valid values is
 * the `spot_types` DB table; the value itself is the row's `slug`
 * (e.g. "plaza", "bowl"). The display name (e.g. "Plaza") is read from
 * `SpotTypeEntity` (sourced from the same table).
 */
export type SpotType = string;

export interface SpotTypeEntity {
  slug: string;
  name: string;
}

/**
 * A single type tag attached to a spot. Carries both the slug
 * (canonical id) and the display name, denormalized from `spot_types`
 * so consumers don't have to look it up.
 */
export interface SpotTypeRef {
  slug: string;
  name: string;
}

export interface SpotLocation {
  lat: number;
  lon: number;
}

export type SpotVisibility = "personal" | "public";
export type SpotOrigin = "seed" | "community" | "user_personal";

export interface MapSpot {
  id: string;
  slug: string;
  name: string;
  city: string;
  citySlug: string;
  types: readonly SpotTypeRef[];
  sports: readonly SportDiscipline[];
  image: string;
  country: string;
  countryCode: string;
  /**
   * Public Instagram profile URL for the spot, or `null` if the spot
   * has no Instagram presence.
   */
  instagram: string | null;
  /**
   * Live total of how many users have verified the spot. Denormalized
   * — kept in sync by the `bump_verification_count` trigger on
   * `verified_spots`. Read path is O(1) (single column on the
   * `spots` row).
   */
  verificationCount: number;
  location: SpotLocation;
}

export interface Spot extends MapSpot {
  address: string;
  visibility: SpotVisibility;
  origin: SpotOrigin;
  communitySubmissionCount: number;
  adminHidden: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TabType =
  | "saved"
  | "map"
  | "games"
  | "support"
  | "admin"
  | "profile"
  | "tv";

export interface Region {
  name: string;
  desc: string;
  count: string;
  image: string;
  link: string;
  countries: readonly string[];
  /**
   * Public, non-hidden spot counts keyed by country display name,
   * built from the uncapped DB aggregate in
   * `DrizzleSpotRepository.listRegions()`. The map searcher's country
   * drill-down prefers these over client-derived counts so the numbers
   * match the DB even though the hydrated client directory is capped
   * at `SPOT_LIST_HARD_CAP` spots.
   */
  countryCounts?: Readonly<Record<string, number>>;
}

export interface Country {
  name: string;
  region: string;
}
