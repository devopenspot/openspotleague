import { youtubeThumbUrl } from "@/lib/tv/urls";
import { formatTvPostDate } from "@/lib/tv/share";
import type { TvCard, TvCategory } from "@/types/tv";

export { youtubeThumbUrl } from "@/lib/tv/urls";

/** Videos posted within this window get the "New" tag. */
export const TV_NEW_WINDOW_DAYS = 14;

export function isRecentTvPost(
  postDate: string,
  now: number = Date.now(),
  windowDays: number = TV_NEW_WINDOW_DAYS,
): boolean {
  const t = new Date(postDate).getTime();
  if (Number.isNaN(t)) return false;
  return now - t <= windowDays * 24 * 60 * 60 * 1000;
}

export interface TvMarqueeItem {
  video: TvCard;
  title: string;
  thumb: string | null;
  meta: string;
  /** Posted within `TV_NEW_WINDOW_DAYS` (computed when the item is built). */
  isNew: boolean;
  disciplineSlug: string;
  disciplineLabel: string;
  categories: readonly TvCategory[];
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Display name for a discipline slug ("bmx" → "BMX"). */
export function formatTvDiscipline(slug: string): string {
  return slug.toLowerCase() === "bmx" ? "BMX" : capitalize(slug);
}

const marqueeItemCache = new WeakMap<TvCard, TvMarqueeItem>();

export function toTvMarqueeItem(video: TvCard): TvMarqueeItem {
  const cached = marqueeItemCache.get(video);
  if (cached) return cached;
  const item: TvMarqueeItem = {
    video,
    title: video.title,
    thumb: youtubeThumbUrl(video.youtubeUrl),
    meta: formatTvPostDate(video.postDate),
    isNew: isRecentTvPost(video.postDate),
    disciplineSlug: video.disciplineSlug,
    disciplineLabel: formatTvDiscipline(video.disciplineSlug),
    categories: video.categories,
  };
  marqueeItemCache.set(video, item);
  return item;
}

export function toTvMarqueeItems(
  videos: readonly TvCard[],
): TvMarqueeItem[] {
  return videos.map(toTvMarqueeItem);
}

export function filterByDiscipline(
  videos: readonly TvCard[],
  discipline: string,
): TvCard[] {
  if (discipline === "all") return [...videos];
  const needle = discipline.toLowerCase();
  return videos.filter(
    (v) => v.disciplineSlug.toLowerCase() === needle,
  );
}

const TV_CATEGORY_LABELS: Readonly<Record<string, string>> = {
  profile: "Rider profiles",
  event: "Events",
  tour: "Tours",
  "video part": "Video parts",
};

/** Display label for a category slug ("music" → "Music"). */
export function formatTvCategory(category: TvCategory): string {
  const trimmed = category.trim();
  if (!trimmed) return "";
  return TV_CATEGORY_LABELS[trimmed.toLowerCase()] ?? capitalize(trimmed);
}

/**
 * Row order by rider moment: hype first, then learning, then longer
 * watches. Anything unlisted keeps its server order after these.
 */
export const TV_ROW_PRIORITY: readonly string[] = [
  "epic tricks",
  "trick",
  "video part",
  "music",
  "learning",
  "game of",
  "profile",
  "event",
  "documentary",
  "tour",
  "lifestyle",
];

function tvRowRank(category: TvCategory): number {
  const normalized = category.trim().toLowerCase();
  const key = normalized.startsWith("game of") ? "game of" : normalized;
  const rank = TV_ROW_PRIORITY.indexOf(key);
  return rank === -1 ? TV_ROW_PRIORITY.length : rank;
}

export function orderTvRows<T extends { category: TvCategory }>(
  rows: readonly T[],
): T[] {
  return [...rows].sort(
    (a, b) => tvRowRank(a.category) - tvRowRank(b.category),
  );
}

/**
 * Validates a `?discipline=` value against known slugs. Returns the
 * lowercase slug, or null for missing/"all"/unknown (unfiltered).
 * Shared by the TV page (SSR truth) and `TvGrid` (back/forward sync).
 */
export function resolveDisciplineParam(
  param: string | null | undefined,
  slugs: readonly string[],
): string | null {
  if (!param) return null;
  const needle = param.trim().toLowerCase();
  if (!needle) return null;
  if (needle === "all") return "all";
  return slugs.some((s) => s.toLowerCase() === needle) ? needle : null;
}

/**
 * Returns the TV path with `discipline` set (or removed if falsy),
 * preserving every other query param (`play`, `thumb`, `title`).
 */
export function withDisciplineParam(
  pathname: string,
  search: string,
  discipline: string,
): string {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  if (!discipline) params.delete("discipline");
  else params.set("discipline", discipline);
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
