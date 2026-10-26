import type { TvVideo, TvCard, TvVideoInput } from "@/types/tv";

export interface TvListOptions {
  disciplineSlug?: string;
  disciplineSlugs?: readonly string[];
  category?: string;
  categories?: readonly string[];
  query?: string;
  year?: number;
  publishedOnly?: boolean;
  /** Hard cap on rows returned (default 500) — tv_videos is curated and small. */
  limit?: number;
}

export interface TvFilterOptionsResult {
  years: readonly number[];
  categories: readonly string[];
}

export interface TvCategoryRowsOptions {
  disciplineSlug?: string;
  publishedOnly?: boolean;
  limit?: number;
}

export interface TvCategoryRowResult {
  category: string;
  videos: readonly TvCard[];
  nextCursor: string | null;
  total: number;
}

export interface TvCardPageOptions extends TvListOptions {
  /** Keyset cursor from a previous `TvCardPageResult` (first page when absent). */
  cursor?: string;
  /**
   * `curated` (default): `sortOrder ASC, postDate DESC, …` — the row order.
   * `newest`: `postDate DESC, createdAt DESC, id DESC`, single page (no
   * cursor) — backs the "New this week" shelf.
   */
  sort?: "curated" | "newest";
  /** Only videos posted within the last N days (honored with `sort: "newest"`). */
  sinceDays?: number;
}

export interface TvCardPageResult {
  items: readonly TvCard[];
  nextCursor: string | null;
}

export interface TvIdListOptions {
  disciplineSlug?: string;
  disciplineSlugs?: readonly string[];
  category?: string;
  publishedOnly?: boolean;
}

export interface TvCountOptions {
  disciplineSlug?: string;
  disciplineSlugs?: readonly string[];
  publishedOnly?: boolean;
}

export interface TvDistinctCategoriesOptions {
  disciplineSlug?: string;
  disciplineSlugs?: readonly string[];
  publishedOnly?: boolean;
}

export interface TvRepository {
  list(options?: TvListOptions): Promise<readonly TvVideo[]>;
  /**
   * First page + totals for all non-empty categories in a single windowed SQL query.
   * Eliminates the 1 + N query fan-out across categories.
   */
  listCategoryRows(options?: TvCategoryRowsOptions): Promise<readonly TvCategoryRowResult[]>;
  /**
   * Slim public cards — same filters/order/limit as `list`, card
   * columns only. Public surfaces (TV page, landing wire) use this;
   * admin keeps `list`.
   */
  listCards(options?: TvListOptions): Promise<readonly TvCard[]>;
  /**
   * One deterministic card page for scroll pagination. Keyset on
   * `(sortOrder, postDate, createdAt, id)` — pages are stable under
   * concurrent publishes and identical for every visitor (shared
   * cache entries, no per-visitor key).
   */
  listCardPage(options?: TvCardPageOptions): Promise<TvCardPageResult>;
  /**
   * Ordered ID list for theater-queue navigation across unloaded
   * pages. IDs only, same order as `listCardPage`; served through the
   * cached `listTvIdList` service (shared across visitors).
   */
  listTvIdList(options?: TvIdListOptions): Promise<readonly string[]>;
  /** Published counts per category (row totals for paginated marquees). */
  countByCategory(options?: TvCountOptions): Promise<readonly { category: string; count: number }[]>;
  /** Published counts per discipline (pill totals). */
  countByDiscipline(options?: TvCountOptions): Promise<readonly { disciplineSlug: string; count: number }[]>;
  /** Distinct available years and categories across published TV videos. */
  getFilterOptions(): Promise<TvFilterOptionsResult>;
  /** Distinct categories across TV videos, optionally filtered by discipline or publication state. */
  listDistinctCategories(options?: TvDistinctCategoriesOptions): Promise<readonly string[]>;
  findById(id: string): Promise<TvVideo | null>;
  /**
   * Single public card (theater deep-links, cross-page queue
   * navigation). Unpublished rows resolve to null.
   */
  findCardById(id: string): Promise<TvCard | null>;
  /**
   * Batch of published public cards by id (theater queue boundary
   * walking): one query for up to `TV_CARD_BATCH_MAX` ids instead of
   * up to N single-card round-trips. Preserves request order
   * (deduplicated); unknown/unpublished ids drop out.
   */
  findCardsByIds(ids: readonly string[]): Promise<readonly TvCard[]>;
  create(input: TvVideoInput, actorId: string): Promise<TvVideo>;
  update(
    id: string,
    input: TvVideoInput,
    expectedUpdatedAt: string,
    actorId: string,
  ): Promise<TvVideo>;
  delete(id: string, expectedUpdatedAt: string, actorId: string): Promise<void>;
}
