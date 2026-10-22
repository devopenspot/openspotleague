import { cacheLife, cacheTag, revalidatePath } from "next/cache";
import { queueTagRevalidate } from "@/lib/cache/deferred";
import { getTvRepositoryAsync } from "@/lib/repositories";
import type { TvVideo, TvCard, TvCategory, TvVideoInput } from "@/types/tv";
import type {
  TvCardPageOptions,
  TvCardPageResult,
  TvCountOptions,
  TvFilterOptionsResult,
  TvIdListOptions,
} from "@/lib/repositories/tv/tv-repository";
import { LIST_CACHE_LIFE as TV_CACHE_LIFE, ITEM_CACHE_LIFE as TV_ITEM_CACHE_LIFE } from "@/lib/cache/lifetimes";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function runListTvVideos(options: {
  disciplineSlug?: string;
  disciplineSlugs?: readonly string[];
  category?: string;
  publishedOnly?: boolean;
} = {}): Promise<readonly TvVideo[]> {
  const repository = await getTvRepositoryAsync();
  return repository.list(options);
}

export async function listTvVideos(): Promise<readonly TvVideo[]> {
  "use cache";
  cacheTag("tv:list");
  cacheLife(TV_CACHE_LIFE);
  return runListTvVideos({ publishedOnly: true });
}

/**
 * Slim public cards for the TV page and landing wire. Same filters as
 * `runListTvVideos`, card columns only — the catalog transfer never
 * carries audit/moderation columns.
 */
export async function runListTvCards(options: {
  disciplineSlug?: string;
  category?: string;
  publishedOnly?: boolean;
  limit?: number;
} = {}): Promise<readonly TvCard[]> {
  const repository = await getTvRepositoryAsync();
  return repository.listCards(options);
}

export async function listTvCards(options: {
  disciplineSlug?: string;
  category?: string;
  publishedOnly?: boolean;
  limit?: number;
} = {}): Promise<readonly TvCard[]> {
  "use cache";
  const normalized = {
    disciplineSlug: options.disciplineSlug?.trim().toLowerCase() || undefined,
    category: options.category?.trim().toLowerCase() || undefined,
    publishedOnly: options.publishedOnly !== false,
    limit: options.limit,
  };
  cacheTag("tv:list");
  cacheLife(TV_CACHE_LIFE);
  return runListTvCards(normalized);
}

/**
 * Single public card (theater deep-links, cross-page queue
 * navigation). Cached per item; unpublished resolves to null.
 */
export async function runFindTvCardById(id: string): Promise<TvCard | null> {
  const normalizedId = id.trim();
  if (!UUID_REGEX.test(normalizedId)) return null;
  const repository = await getTvRepositoryAsync();
  return repository.findCardById(normalizedId);
}

export async function findTvCardById(id: string): Promise<TvCard | null> {
  "use cache";
  const normalizedId = id.trim();
  if (!UUID_REGEX.test(normalizedId)) return null;
  cacheTag(`tv:item:${normalizedId}`);
  cacheLife(TV_ITEM_CACHE_LIFE);
  return runFindTvCardById(normalizedId);
}

/** Batch nav-miss window (theater boundary walking) — route path. */
export async function runFindTvCardsByIds(
  ids: readonly string[],
): Promise<readonly TvCard[]> {
  const validIds = [...new Set(ids.map((id) => id.trim()).filter((id) => UUID_REGEX.test(id)))];
  if (validIds.length === 0) return [];
  const repository = await getTvRepositoryAsync();
  return repository.findCardsByIds(validIds);
}

export async function findTvCardsByIds(
  ids: readonly string[],
): Promise<readonly TvCard[]> {
  "use cache";
  const validIds = [...new Set(ids.map((id) => id.trim()).filter((id) => UUID_REGEX.test(id)))].sort();
  if (validIds.length === 0) return [];
  cacheTag("tv:list");
  for (const id of validIds) cacheTag(`tv:item:${id}`);
  cacheLife(TV_CACHE_LIFE);
  return runFindTvCardsByIds(validIds);
}

// ---------- paginated rows + queue navigation ----------
//
// Card pages are deterministic (same order for every visitor), so page
// entries are shared across visitors — no per-visitor key, unlike the
// seeded marquee shuffle. All share `tv:list`, invalidated by
// `revalidateTvPaths` on any TV mutation.

/** Initial cards per category row (constant first paint). */
export const TV_ROW_PAGE_LIMIT = 12;

export async function runListTvCardPage(
  options: TvCardPageOptions = {},
): Promise<TvCardPageResult> {
  const repository = await getTvRepositoryAsync();
  return repository.listCardPage({ publishedOnly: true, ...options });
}

export async function listTvCardPage(
  options: TvCardPageOptions = {},
): Promise<TvCardPageResult> {
  "use cache";
  const normalized: TvCardPageOptions = {
    disciplineSlug: options.disciplineSlug?.trim().toLowerCase() || undefined,
    category: options.category?.trim().toLowerCase() || undefined,
    categories: options.categories,
    query: options.query?.trim() || undefined,
    year:
      typeof options.year === "number" && !Number.isNaN(options.year)
        ? options.year
        : undefined,
    cursor: options.cursor?.trim() || undefined,
    limit: options.limit,
    publishedOnly: options.publishedOnly !== false,
  };
  cacheTag("tv:list");
  cacheLife(TV_CACHE_LIFE);
  return runListTvCardPage(normalized);
}

export async function runGetTvFilterOptions(): Promise<TvFilterOptionsResult> {
  const repository = await getTvRepositoryAsync();
  return repository.getFilterOptions();
}

export async function getTvFilterOptions(): Promise<TvFilterOptionsResult> {
  "use cache";
  cacheTag("tv:list");
  cacheLife(TV_CACHE_LIFE);
  return runGetTvFilterOptions();
}

export async function runListTvIdList(
  options: TvIdListOptions = {},
): Promise<readonly string[]> {
  const repository = await getTvRepositoryAsync();
  return repository.listTvIdList({ publishedOnly: true, ...options });
}

export async function listTvIdList(
  options: TvIdListOptions = {},
): Promise<readonly string[]> {
  "use cache";
  const normalized: TvIdListOptions = {
    disciplineSlug: options.disciplineSlug?.trim().toLowerCase() || undefined,
    category: options.category?.trim().toLowerCase() || undefined,
    publishedOnly: options.publishedOnly !== false,
  };
  cacheTag("tv:list");
  cacheLife(TV_CACHE_LIFE);
  return runListTvIdList(normalized);
}

export async function runCountTvByCategory(
  options: TvCountOptions = {},
): Promise<readonly { category: string; count: number }[]> {
  const repository = await getTvRepositoryAsync();
  return repository.countByCategory({ publishedOnly: true, ...options });
}

export async function countTvByCategory(
  options: TvCountOptions = {},
): Promise<readonly { category: string; count: number }[]> {
  "use cache";
  const normalized: TvCountOptions = {
    disciplineSlug: options.disciplineSlug?.trim().toLowerCase() || undefined,
    publishedOnly: options.publishedOnly !== false,
  };
  cacheTag("tv:list");
  cacheLife(TV_CACHE_LIFE);
  return runCountTvByCategory(normalized);
}

export async function runCountTvByDiscipline(
  options: TvCountOptions = {},
): Promise<readonly { disciplineSlug: string; count: number }[]> {
  const repository = await getTvRepositoryAsync();
  return repository.countByDiscipline({ publishedOnly: true, ...options });
}

export async function countTvByDiscipline(
  options: TvCountOptions = {},
): Promise<readonly { disciplineSlug: string; count: number }[]> {
  "use cache";
  const normalized: TvCountOptions = {
    disciplineSlug: options.disciplineSlug?.trim().toLowerCase() || undefined,
    publishedOnly: options.publishedOnly !== false,
  };
  cacheTag("tv:list");
  cacheLife(TV_CACHE_LIFE);
  return runCountTvByDiscipline(normalized);
}

export interface TvCategoryRow {
  category: TvCategory;
  videos: readonly TvCard[];
  nextCursor: string | null;
  total: number;
}

/**
 * First page + totals for every non-empty category, in canonical
 * category order (followed by custom categories alphabetically).
 * One shared cache entry per discipline — the TV page renders
 * constant-size first paint regardless of catalog size.
 */
export async function runListTvCategoryRows(
  disciplineSlug?: string,
): Promise<readonly TvCategoryRow[]> {
  const repository = await getTvRepositoryAsync();
  const normalized = disciplineSlug?.trim().toLowerCase() || undefined;
  return repository.listCategoryRows({
    publishedOnly: true,
    disciplineSlug: normalized,
    limit: TV_ROW_PAGE_LIMIT,
  });
}

export async function listTvCategoryRows(
  disciplineSlug?: string,
): Promise<readonly TvCategoryRow[]> {
  "use cache";
  const normalized = disciplineSlug?.trim().toLowerCase() || undefined;
  cacheTag("tv:list");
  cacheLife(TV_CACHE_LIFE);
  return runListTvCategoryRows(normalized);
}

export async function listAllTvVideos(): Promise<readonly TvVideo[]> {
  const repository = await getTvRepositoryAsync();
  return repository.list({});
}

export async function getTvVideoById(id: string): Promise<TvVideo | null> {
  const repository = await getTvRepositoryAsync();
  return repository.findById(id);
}

export async function createTvVideo(input: TvVideoInput, actorId: string): Promise<TvVideo> {
  const repository = await getTvRepositoryAsync();
  const video = await repository.create(input, actorId);
  revalidateTvPaths(video.id);
  return video;
}

export async function updateTvVideo(
  id: string,
  input: TvVideoInput,
  expectedUpdatedAt: string,
  actorId: string,
): Promise<TvVideo> {
  const repository = await getTvRepositoryAsync();
  const video = await repository.update(id, input, expectedUpdatedAt, actorId);
  revalidateTvPaths(video.id);
  return video;
}

export async function deleteTvVideo(
  id: string,
  expectedUpdatedAt: string,
  actorId: string,
): Promise<void> {
  const repository = await getTvRepositoryAsync();
  await repository.delete(id, expectedUpdatedAt, actorId);
  revalidateTvPaths(id);
}

function revalidateTvPaths(videoId?: string) {
  queueTagRevalidate("tv:list", TV_CACHE_LIFE);
  if (videoId) queueTagRevalidate(`tv:item:${videoId}`, TV_ITEM_CACHE_LIFE);
  try {
    revalidatePath("/tv");
    revalidatePath("/admin/tv");
    revalidatePath("/");
  } catch {
    // revalidatePath is a Next.js server-only API; ignore if invoked outside cache context (tests).
  }
}
