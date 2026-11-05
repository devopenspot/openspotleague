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

/** Hub tabs on the contest page (`/league/[slug]?tab=…`). */
export type ContestHubTab = "overview" | "standings" | "my-runs" | "judging" | "run";

/** A contest hub tab, anchored to the hub section. */
export function buildContestHubUrl(slug: string, tab: ContestHubTab): string {
  return `${buildContestDetailUrl(slug)}?tab=${tab}#hub`;
}

/** Organizer tools: the hub's "Run the contest" tab. */
export function buildContestManageUrl(slug: string): string {
  return buildContestHubUrl(slug, "run");
}

/** Judging: the hub's "Judging" tab. */
export function buildContestJudgeUrl(slug: string): string {
  return buildContestHubUrl(slug, "judging");
}

/** A rider's shareable result card page (`/league/[slug]/r/[userId]`). */
export function buildContestResultUrl(slug: string, userId: string): string {
  return `${buildContestDetailUrl(slug)}/r/${encodeURIComponent(userId)}`;
}

/** Global League ranking (`/league/ranking`). */
export const LEAGUE_RANKING_PATH = `${ROUTES.league}/ranking`;

/** Invite landing (`/league/join/[code]`) shared by link and QR code. */
export function buildContestJoinUrl(code: string): string {
  return `${ROUTES.league}/join/${encodeURIComponent(code)}`;
}

/** Contest creation form (`/league/new`). */
export const CONTEST_NEW_PATH = `${ROUTES.league}/new`;
