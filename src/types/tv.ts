export const TV_CATEGORY_VALUES = [
  "profile",
  "event",
  "music",
  "trick",
  "documentary",
  "lifestyle",
] as const;

export type TvDefaultCategory = (typeof TV_CATEGORY_VALUES)[number];
export type TvCategory = string;

const CANONICAL_CATEGORY_SET: ReadonlySet<string> = new Set(TV_CATEGORY_VALUES);

/**
 * Orders categories with canonical `TV_CATEGORY_VALUES` first, followed by
 * any custom categories sorted alphabetically.
 */
export function orderTvCategories(categories: Iterable<string>): TvCategory[] {
  const seen = new Set<string>();
  for (const raw of categories) {
    const normalized = raw.trim().toLowerCase();
    if (normalized) seen.add(normalized);
  }
  const canonical = TV_CATEGORY_VALUES.filter((c) => seen.has(c));
  const custom = [...seen]
    .filter((c) => !CANONICAL_CATEGORY_SET.has(c))
    .sort((a, b) => a.localeCompare(b));
  return [...canonical, ...custom];
}

/**
 * Max ids per theater nav-miss batch request — one window of the
 * ordered queue walk. Keeps the worst boundary step at one invocation
 * + one Pooler query instead of up to N single-card round-trips.
 */
export const TV_CARD_BATCH_MAX = 10;

export interface TvVideo {
  id: string;
  title: string;
  youtubeUrl: string;
  embedUrl: string;
  disciplineSlug: string;
  categories: readonly TvCategory[];
  postDate: string;
  published: boolean;
  sortOrder: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TvVideoInput {
  title: string;
  youtubeUrl: string;
  disciplineSlug: string;
  categories: readonly TvCategory[];
  postDate: string;
  published: boolean;
  sortOrder: number;
}

/**
 * Slim public projection of a video — the only fields the TV wire,
 * queue strip, and theater modal read. Served by the card query path
 * so the catalog transfer never carries audit/moderation columns
 * (`createdBy/updatedBy`, `published`, `sortOrder`, timestamps).
 */
export interface TvCard {
  id: string;
  title: string;
  youtubeUrl: string;
  embedUrl: string;
  disciplineSlug: string;
  categories: readonly TvCategory[];
  postDate: string;
}
