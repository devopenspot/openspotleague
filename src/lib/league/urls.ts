import { ROUTES } from "@/lib/navigation/nav";
import { slugify } from "@/lib/utils/slug";

/**
 * Every contest path in the app is built here, so the `/league/**` URL
 * space has a single source of truth. Pure functions: safe on server and
 * client, no URL reads, no clock.
 */

export interface BuildContestMapUrlInput {
  location: {
    country: string;
    region?: string;
  };
}

/**
 * Deep link from a contest to the map, filtered to the contest's country
 * (and optional region). The URL is the single source of truth for the
 * map's layer + filter state — `useMapLayer` and `useMapFilter` are the only
 * readers. The layer param keeps both spots and events visible, so this link
 * stays stable if the map's default layer set changes later.
 */
export function buildContestMapUrl(input: BuildContestMapUrlInput): string {
  const countrySlug = slugify(input.location.country);
  const params = new URLSearchParams();
  params.set("layer", "spots,events");
  params.set("country", countrySlug);
  if (input.location.region) {
    params.set("region", slugify(input.location.region));
  }
  return `${ROUTES.map}?${params.toString()}`;
}

/** Contest detail page (`/league/[slug]`). */
export function buildContestDetailUrl(slug: string): string {
  return `${ROUTES.league}/${encodeURIComponent(slug)}`;
}

/** Organizer console (`/league/[slug]/manage`). */
export function buildContestManageUrl(slug: string): string {
  return `${buildContestDetailUrl(slug)}/manage`;
}

/** Judge queue (`/league/[slug]/judge`). */
export function buildContestJudgeUrl(slug: string): string {
  return `${buildContestDetailUrl(slug)}/judge`;
}

/** Invite landing (`/league/join/[code]`) shared by link and QR code. */
export function buildContestJoinUrl(code: string): string {
  return `${ROUTES.league}/join/${encodeURIComponent(code)}`;
}

/** Contest creation form (`/league/new`). */
export const CONTEST_NEW_PATH = `${ROUTES.league}/new`;
