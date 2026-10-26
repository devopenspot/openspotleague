import { and, asc, desc, eq, gte, ilike, inArray, lt, sql } from "drizzle-orm";
import { type drizzle } from "drizzle-orm/postgres-js";
import { tvVideos, sportDisciplines } from "@/db/schema";
import type { TvVideoRow } from "@/db/schema";
import { parseYouTubeVideoUrl } from "@/lib/tv/urls";
import { TV_CARD_BATCH_MAX, orderTvCategories, type TvVideo, type TvCard, type TvCategory, type TvVideoInput } from "@/types/tv";
import type {
  TvCardPageOptions,
  TvCardPageResult,
  TvCategoryRowResult,
  TvCategoryRowsOptions,
  TvCountOptions,
  TvDistinctCategoriesOptions,
  TvFilterOptionsResult,
  TvIdListOptions,
  TvListOptions,
  TvRepository,
} from "./tv-repository";
import { decodeTvPageCursor, encodeTvPageCursor } from "./tv-pagination";
import {
  InvalidConcurrencyTokenError,
  InvalidReferenceError,
  StaleRecordError,
} from "../core/errors";
import { deleteWithOccAudit } from "../core/occ-delete";
import { recordContentAudit } from "../admin/content-audit";

function normalizeCategories(
  raw: readonly string[] | null | undefined,
): readonly TvCategory[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: TvCategory[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const normalized = item.trim().toLowerCase();
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      out.push(normalized);
    }
  }
  return out;
}

function toTvVideo(row: TvVideoRow): TvVideo {
  const parsed = parseYouTubeVideoUrl(row.youtubeUrl);
  return {
    id: row.id,
    title: row.title,
    youtubeUrl: row.youtubeUrl,
    embedUrl: parsed?.embedUrl ?? row.youtubeUrl,
    disciplineSlug: row.disciplineSlug,
    categories: normalizeCategories(row.categories),
    postDate: row.postDate.toISOString(),
    published: row.published,
    sortOrder: row.sortOrder,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Slim public projection — the only fields the TV wire, queue strip,
 * and theater modal read. Drops audit/moderation columns
 * (`createdBy/updatedBy`, `published`, `sortOrder`, timestamps).
 */
export function toTvCard(row: {
  id: string;
  title: string;
  youtubeUrl: string;
  disciplineSlug: string;
  categories: readonly string[];
  postDate: Date;
}): TvCard {
  const parsed = parseYouTubeVideoUrl(row.youtubeUrl);
  return {
    id: row.id,
    title: row.title,
    youtubeUrl: row.youtubeUrl,
    embedUrl: parsed?.embedUrl ?? row.youtubeUrl,
    disciplineSlug: row.disciplineSlug,
    categories: normalizeCategories(row.categories),
    postDate: row.postDate.toISOString(),
  };
}

function tvCardColumns() {
  return {
    id: tvVideos.id,
    title: tvVideos.title,
    youtubeUrl: tvVideos.youtubeUrl,
    disciplineSlug: tvVideos.disciplineSlug,
    categories: tvVideos.categories,
    postDate: tvVideos.postDate,
  };
}

export class DrizzleTvRepository implements TvRepository {
  constructor(private readonly db: ReturnType<typeof drizzle>) {}

  async list(options: TvListOptions = {}): Promise<readonly TvVideo[]> {
    const conditions = [];
    if (options.publishedOnly) conditions.push(eq(tvVideos.published, true));
    if (options.disciplineSlug)
      conditions.push(eq(tvVideos.disciplineSlug, options.disciplineSlug.toLowerCase()));
    if (options.disciplineSlugs && options.disciplineSlugs.length > 0) {
      const normalized = options.disciplineSlugs.map((s) => s.toLowerCase());
      conditions.push(inArray(tvVideos.disciplineSlug, normalized));
    }
    if (options.category) {
      const normalized = options.category.trim().toLowerCase();
      if (normalized) {
        conditions.push(sql`${tvVideos.categories} @> ARRAY[${normalized}]::text[]`);
      }
    }
    if (options.categories && options.categories.length > 0) {
      const normalized = options.categories
        .map((c) => c.trim().toLowerCase())
        .filter(Boolean);
      if (normalized.length > 0) {
        conditions.push(sql`${tvVideos.categories} && ARRAY[${normalized}]::text[]`);
      }
    }
    if (options.query) {
      const sanitized = options.query.trim().replace(/[%_\\]/g, "\\$&");
      if (sanitized) {
        conditions.push(ilike(tvVideos.title, `%${sanitized}%`));
      }
    }
    if (typeof options.year === "number" && !Number.isNaN(options.year)) {
      const start = new Date(Date.UTC(options.year, 0, 1));
      const end = new Date(Date.UTC(options.year + 1, 0, 1));
      conditions.push(gte(tvVideos.postDate, start));
      conditions.push(lt(tvVideos.postDate, end));
    }

    const whereClause = conditions.length ? and(...conditions) : undefined;
    const limit = Math.min(Math.max(options.limit ?? 500, 1), 500);

    const rows = await (whereClause
      ? this.db
          .select()
          .from(tvVideos)
          .where(whereClause)
          .orderBy(asc(tvVideos.sortOrder), desc(tvVideos.postDate), desc(tvVideos.createdAt))
          .limit(limit)
      : this.db
          .select()
          .from(tvVideos)
          .orderBy(asc(tvVideos.sortOrder), desc(tvVideos.postDate), desc(tvVideos.createdAt))
          .limit(limit));

    return rows.map(toTvVideo);
  }

  /**
   * Slim card list for public surfaces (TV page, landing wire). Same
   * filters/order/limit as `list`, but only card columns leave the DB.
   */
  async listCards(options: TvListOptions = {}): Promise<readonly TvCard[]> {
    const conditions = [];
    if (options.publishedOnly) conditions.push(eq(tvVideos.published, true));
    if (options.disciplineSlug)
      conditions.push(eq(tvVideos.disciplineSlug, options.disciplineSlug.toLowerCase()));
    if (options.disciplineSlugs && options.disciplineSlugs.length > 0) {
      const normalized = options.disciplineSlugs.map((s) => s.toLowerCase());
      conditions.push(inArray(tvVideos.disciplineSlug, normalized));
    }
    if (options.category) {
      const normalized = options.category.trim().toLowerCase();
      if (normalized) {
        conditions.push(sql`${tvVideos.categories} @> ARRAY[${normalized}]::text[]`);
      }
    }
    if (options.categories && options.categories.length > 0) {
      const normalized = options.categories
        .map((c) => c.trim().toLowerCase())
        .filter(Boolean);
      if (normalized.length > 0) {
        conditions.push(sql`${tvVideos.categories} && ARRAY[${normalized}]::text[]`);
      }
    }
    if (options.query) {
      const sanitized = options.query.trim().replace(/[%_\\]/g, "\\$&");
      if (sanitized) {
        conditions.push(ilike(tvVideos.title, `%${sanitized}%`));
      }
    }
    if (typeof options.year === "number" && !Number.isNaN(options.year)) {
      const start = new Date(Date.UTC(options.year, 0, 1));
      const end = new Date(Date.UTC(options.year + 1, 0, 1));
      conditions.push(gte(tvVideos.postDate, start));
      conditions.push(lt(tvVideos.postDate, end));
    }

    const whereClause = conditions.length ? and(...conditions) : undefined;
    const limit = Math.min(Math.max(options.limit ?? 500, 1), 500);

    const base = () =>
      this.db
        .select(tvCardColumns())
        .from(tvVideos)
        .orderBy(asc(tvVideos.sortOrder), desc(tvVideos.postDate), desc(tvVideos.createdAt))
        .$dynamic();
    const rows = await (whereClause
      ? base().where(whereClause).limit(limit)
      : base().limit(limit));

    return rows.map(toTvCard);
  }

  /**
   * First page + totals for all non-empty categories in a single windowed SQL query.
   * Replaces 1 + N sequential/parallel queries with exactly 1 Pooler checkout.
   */
  async listCategoryRows(
    options: TvCategoryRowsOptions = {},
  ): Promise<readonly TvCategoryRowResult[]> {
    const limit = Math.min(Math.max(options.limit ?? 12, 1), 50);
    const conditions = [eq(tvVideos.published, true)];
    if (options.disciplineSlug) {
      conditions.push(
        eq(tvVideos.disciplineSlug, options.disciplineSlug.toLowerCase()),
      );
    }
    const whereClause = and(...conditions);

    const rows = await this.db.execute<{
      id: string;
      title: string;
      youtube_url: string;
      discipline_slug: string;
      categories: string[] | string;
      post_date: Date | string;
      sort_order: number | string;
      created_at: Date | string;
      category: string;
      total: number | string;
      rn: number | string;
    }>(sql`
      with unnested as (
        select
          ${tvVideos.id} as id,
          ${tvVideos.title} as title,
          ${tvVideos.youtubeUrl} as youtube_url,
          ${tvVideos.disciplineSlug} as discipline_slug,
          ${tvVideos.categories} as categories,
          ${tvVideos.postDate} as post_date,
          ${tvVideos.sortOrder} as sort_order,
          ${tvVideos.createdAt} as created_at,
          cat.category as category,
          count(*) over (partition by cat.category)::int as total,
          row_number() over (
            partition by cat.category
            order by ${tvVideos.sortOrder} asc, ${tvVideos.postDate} desc, ${tvVideos.createdAt} desc, ${tvVideos.id} desc
          )::int as rn
        from ${tvVideos}
        cross join lateral unnest(${tvVideos.categories}) as cat(category)
        where ${whereClause}
      )
      select *
      from unnested
      where rn <= ${limit + 1}
      order by category asc, rn asc
    `);

    const cardCache = new Map<string, TvCard>();
    const byCategory = new Map<
      string,
      {
        rows: Array<(typeof rows)[number]>;
        total: number;
      }
    >();

    for (const r of rows) {
      const cat = r.category.trim().toLowerCase();
      if (!cat) continue;
      let bucket = byCategory.get(cat);
      if (!bucket) {
        bucket = { rows: [], total: Number(r.total) };
        byCategory.set(cat, bucket);
      }
      bucket.rows.push(r);
    }

    const orderedCategories = orderTvCategories(byCategory.keys());

    return orderedCategories.map((category) => {
      const bucket = byCategory.get(category)!;
      const catRows = bucket.rows;
      const pageRows = catRows.slice(0, limit);
      const items: TvCard[] = pageRows.map((r) => {
        let card = cardCache.get(r.id);
        if (!card) {
          const rawCategories = Array.isArray(r.categories)
            ? r.categories
            : typeof r.categories === "string" && r.categories.startsWith("{")
              ? r.categories.slice(1, -1).split(",")
              : [];
          card = toTvCard({
            id: r.id,
            title: r.title,
            youtubeUrl: r.youtube_url,
            disciplineSlug: r.discipline_slug,
            categories: normalizeCategories(rawCategories),
            postDate: r.post_date instanceof Date ? r.post_date : new Date(r.post_date),
          });
          cardCache.set(r.id, card);
        }
        return card;
      });

      const last = pageRows[pageRows.length - 1];
      const nextCursor =
        catRows.length > limit && last
          ? encodeTvPageCursor({
              sortOrder: Number(last.sort_order),
              postDate:
                last.post_date instanceof Date
                  ? last.post_date.toISOString()
                  : new Date(last.post_date).toISOString(),
              createdAt:
                last.created_at instanceof Date
                  ? last.created_at.toISOString()
                  : new Date(last.created_at).toISOString(),
              id: last.id,
            })
          : null;

      return {
        category,
        videos: items,
        nextCursor,
        total: bucket.total,
      };
    });
  }

  /**
   * Single public card (theater deep-links, cross-page queue
   * navigation). Unpublished rows stay invisible to public callers.
   */
  async findCardById(id: string): Promise<TvCard | null> {
    const [row] = await this.db
      .select(tvCardColumns())
      .from(tvVideos)
      .where(and(eq(tvVideos.id, id), eq(tvVideos.published, true)))
      .limit(1);
    return row ? toTvCard(row) : null;
  }

  /**
   * Batch of published public cards by id (theater queue boundary
   * walking): one Pooler query for the whole window. Rows come back in
   * arbitrary order — request order is re-applied here; duplicates
   * collapse and unknown/unpublished ids simply miss.
   */
  async findCardsByIds(ids: readonly string[]): Promise<readonly TvCard[]> {
    const unique = [...new Set(ids)].slice(0, TV_CARD_BATCH_MAX);
    if (unique.length === 0) return [];
    const rows = await this.db
      .select(tvCardColumns())
      .from(tvVideos)
      .where(and(inArray(tvVideos.id, unique), eq(tvVideos.published, true)))
      .limit(unique.length);
    const byId = new Map(rows.map((row) => [row.id, toTvCard(row)] as const));
    return unique
      .map((id) => byId.get(id))
      .filter((v): v is TvCard => v !== undefined);
  }

  private cardPageFilters(options: TvCardPageOptions | TvIdListOptions) {
    const conditions = [];
    if (options.publishedOnly !== false) conditions.push(eq(tvVideos.published, true));
    if (options.disciplineSlug)
      conditions.push(eq(tvVideos.disciplineSlug, options.disciplineSlug.toLowerCase()));
    if ("disciplineSlugs" in options && options.disciplineSlugs && options.disciplineSlugs.length > 0) {
      const normalized = options.disciplineSlugs.map((s) => s.toLowerCase());
      conditions.push(inArray(tvVideos.disciplineSlug, normalized));
    }
    if ("category" in options && options.category) {
      const normalized = options.category.trim().toLowerCase();
      if (normalized) {
        conditions.push(sql`${tvVideos.categories} @> ARRAY[${normalized}]::text[]`);
      }
    }
    if ("categories" in options && options.categories && options.categories.length > 0) {
      const normalized = options.categories
        .map((c) => c.trim().toLowerCase())
        .filter(Boolean);
      if (normalized.length > 0) {
        conditions.push(sql`${tvVideos.categories} && ARRAY[${normalized}]::text[]`);
      }
    }
    if ("query" in options && options.query) {
      const sanitized = options.query.trim().replace(/[%_\\]/g, "\\$&");
      if (sanitized) {
        conditions.push(ilike(tvVideos.title, `%${sanitized}%`));
      }
    }
    if (
      "sinceDays" in options &&
      typeof options.sinceDays === "number" &&
      Number.isFinite(options.sinceDays) &&
      options.sinceDays > 0
    ) {
      const since = new Date(Date.now() - options.sinceDays * 24 * 60 * 60 * 1000);
      conditions.push(gte(tvVideos.createdAt, since));
    }
    if ("year" in options && typeof options.year === "number" && !Number.isNaN(options.year)) {
      const start = new Date(Date.UTC(options.year, 0, 1));
      const end = new Date(Date.UTC(options.year + 1, 0, 1));
      conditions.push(gte(tvVideos.postDate, start));
      conditions.push(lt(tvVideos.postDate, end));
    }
    return conditions;
  }

  /**
   * One deterministic card page. Keyset on
   * `(sortOrder ASC, postDate DESC, createdAt DESC, id DESC)` — `id`
   * breaks full ties so concurrent publishes never duplicate or skip
   * rows across pages.
   */
  async listCardPage(options: TvCardPageOptions = {}): Promise<TvCardPageResult> {
    const limit = Math.min(Math.max(options.limit ?? 12, 1), 50);
    const conditions = this.cardPageFilters(options);
    const cursor = decodeTvPageCursor(options.cursor);
    if (cursor) {
      conditions.push(sql`(
        ${tvVideos.sortOrder} > ${cursor.sortOrder}
        or (${tvVideos.sortOrder} = ${cursor.sortOrder} and ${tvVideos.postDate} < ${cursor.postDate}::timestamptz)
        or (${tvVideos.sortOrder} = ${cursor.sortOrder} and ${tvVideos.postDate} = ${cursor.postDate}::timestamptz and ${tvVideos.createdAt} < ${cursor.createdAt}::timestamptz)
        or (${tvVideos.sortOrder} = ${cursor.sortOrder} and ${tvVideos.postDate} = ${cursor.postDate}::timestamptz and ${tvVideos.createdAt} = ${cursor.createdAt}::timestamptz and ${tvVideos.id} < ${cursor.id}::uuid)
      )`);
    }
    const whereClause = conditions.length ? and(...conditions) : undefined;
    const newest = options.sort === "newest";
    // sortOrder/createdAt ride along for the next-page cursor only —
    // they never reach the card payload.
    const base = () =>
      this.db
        .select({
          ...tvCardColumns(),
          sortOrder: tvVideos.sortOrder,
          createdAt: tvVideos.createdAt,
        })
        .from(tvVideos)
        .orderBy(
          ...(newest
            ? [desc(tvVideos.createdAt), desc(tvVideos.id)]
            : [
                asc(tvVideos.sortOrder),
                desc(tvVideos.postDate),
                desc(tvVideos.createdAt),
                desc(tvVideos.id),
              ]),
        )
        .$dynamic();
    const rows = await (whereClause
      ? base().where(whereClause).limit(limit + 1)
      : base().limit(limit + 1));
    const pageRows = rows.slice(0, limit);
    const items = pageRows.map(toTvCard);
    const last = pageRows[pageRows.length - 1];
    return {
      items,
      nextCursor:
        !newest && rows.length > limit && last
          ? encodeTvPageCursor({
              sortOrder: last.sortOrder,
              postDate: last.postDate.toISOString(),
              createdAt: last.createdAt.toISOString(),
              id: last.id,
            })
          : null,
    };
  }

  /**
   * Ordered ID list for theater-queue navigation. IDs only, page order
   * (plus `id` tiebreak) — bounded by the curated-table cap.
   */
  async listTvIdList(options: TvIdListOptions = {}): Promise<readonly string[]> {
    const conditions = this.cardPageFilters(options);
    const whereClause = conditions.length ? and(...conditions) : undefined;
    const base = () =>
      this.db
        .select({ id: tvVideos.id })
        .from(tvVideos)
        .orderBy(
          asc(tvVideos.sortOrder),
          desc(tvVideos.postDate),
          desc(tvVideos.createdAt),
          desc(tvVideos.id),
        )
        .$dynamic();
    const rows = await (whereClause ? base().where(whereClause).limit(500) : base().limit(500));
    return rows.map((r) => r.id);
  }

  async countByCategory(options: TvCountOptions = {}) {
    const conditions = this.cardPageFilters(options);
    const whereClause = conditions.length ? and(...conditions) : undefined;
    const categoryColumn = sql<string>`unnest(${tvVideos.categories})`;
    const base = () =>
      this.db
        .select({ category: categoryColumn, count: sql<number>`count(*)::int` })
        .from(tvVideos)
        .groupBy(sql`1`)
        .$dynamic();
    const rows = await (whereClause ? base().where(whereClause) : base());
    return rows.map((r) => ({ category: r.category, count: Number(r.count) }));
  }

  async countByDiscipline(options: TvCountOptions = {}) {
    const conditions = this.cardPageFilters(options);
    const whereClause = conditions.length ? and(...conditions) : undefined;
    const base = () =>
      this.db
        .select({ disciplineSlug: tvVideos.disciplineSlug, count: sql<number>`count(*)::int` })
        .from(tvVideos)
        .groupBy(tvVideos.disciplineSlug)
        .$dynamic();
    const rows = await (whereClause ? base().where(whereClause) : base());
    return rows.map((r) => ({ disciplineSlug: r.disciplineSlug, count: Number(r.count) }));
  }

  async getFilterOptions(): Promise<TvFilterOptionsResult> {
    const [yearsRows, categoriesRows] = await Promise.all([
      this.db.execute<{ year: number | string }>(sql`
        select distinct extract(year from ${tvVideos.postDate})::int as year
        from ${tvVideos}
        where ${tvVideos.published} = true
        order by year desc
      `),
      this.db.execute<{ category: string }>(sql`
        select distinct unnest(${tvVideos.categories}) as category
        from ${tvVideos}
        where ${tvVideos.published} = true
        order by category asc
      `),
    ]);

    const years = (yearsRows ?? [])
      .map((r) => Number(r.year))
      .filter((y) => Number.isFinite(y));
    const categories = orderTvCategories(
      (categoriesRows ?? []).map((r) => r.category).filter(Boolean),
    );

    return { years, categories };
  }

  async listDistinctCategories(
    options: TvDistinctCategoriesOptions = {},
  ): Promise<readonly string[]> {
    const conditions = [];
    if (options.publishedOnly) {
      conditions.push(eq(tvVideos.published, true));
    }
    if (options.disciplineSlug) {
      conditions.push(eq(tvVideos.disciplineSlug, options.disciplineSlug.trim().toLowerCase()));
    } else if (options.disciplineSlugs && options.disciplineSlugs.length > 0) {
      const normalized = options.disciplineSlugs
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      if (normalized.length > 0) {
        conditions.push(inArray(tvVideos.disciplineSlug, normalized));
      }
    }

    const whereClause = conditions.length ? and(...conditions) : undefined;
    const rows = await this.db.execute<{ category: string }>(
      whereClause
        ? sql`
          select distinct unnest(${tvVideos.categories}) as category
          from ${tvVideos}
          where ${whereClause}
          order by category asc
        `
        : sql`
          select distinct unnest(${tvVideos.categories}) as category
          from ${tvVideos}
          order by category asc
        `,
    );

    return orderTvCategories((rows ?? []).map((r) => r.category).filter(Boolean));
  }

  async findById(id: string): Promise<TvVideo | null> {
    const [row] = await this.db.select().from(tvVideos).where(eq(tvVideos.id, id)).limit(1)
    return row ? toTvVideo(row) : null
  }

  async create(input: TvVideoInput, actorId: string): Promise<TvVideo> {
    const categories = [...normalizeCategories(input.categories)];
    const [discipline] = await this.db
      .select({ slug: sportDisciplines.slug })
      .from(sportDisciplines)
      .where(eq(sportDisciplines.slug, input.disciplineSlug.toLowerCase()))
      .limit(1);
    if (!discipline) throw new InvalidReferenceError(`Unknown discipline: ${input.disciplineSlug}`);

    const [row] = await this.db
      .insert(tvVideos)
      .values({
        title: input.title,
        youtubeUrl: input.youtubeUrl,
        disciplineSlug: discipline.slug,
        categories,
        postDate: new Date(input.postDate),
        published: input.published,
        sortOrder: input.sortOrder,
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();
    if (!row) throw new Error("TV video was not created");

    await recordContentAudit(this.db, {
      actorId,
      entityType: "tv_video",
      entityId: row.id,
      disciplineSlug: row.disciplineSlug,
      action: "create",
      before: null,
      after: row as unknown as Record<string, unknown>,
    });

    return toTvVideo(row);
  }

  async update(
    id: string,
    input: TvVideoInput,
    expectedUpdatedAt: string,
    actorId: string,
  ): Promise<TvVideo> {
    const expectedDate = new Date(expectedUpdatedAt);
    if (!Number.isFinite(expectedDate.getTime())) throw new InvalidConcurrencyTokenError();
    const categories = [...normalizeCategories(input.categories)];

    const [existing] = await this.db.select().from(tvVideos).where(eq(tvVideos.id, id)).limit(1);
    if (!existing) throw new Error(`TV video not found: ${id}`);
    if (existing.updatedAt.getTime() !== expectedDate.getTime()) throw new StaleRecordError();

    const [discipline] = await this.db
      .select({ slug: sportDisciplines.slug })
      .from(sportDisciplines)
      .where(eq(sportDisciplines.slug, input.disciplineSlug.toLowerCase()))
      .limit(1);
    if (!discipline) throw new InvalidReferenceError(`Unknown discipline: ${input.disciplineSlug}`);

    const before = existing;
    const [row] = await this.db
      .update(tvVideos)
      .set({
        title: input.title,
        youtubeUrl: input.youtubeUrl,
        disciplineSlug: discipline.slug,
        categories,
        postDate: new Date(input.postDate),
        published: input.published,
        sortOrder: input.sortOrder,
        updatedBy: actorId,
        updatedAt: new Date(),
      })
      .where(and(eq(tvVideos.id, id), eq(tvVideos.updatedAt, expectedDate)))
      .returning();
    if (!row) throw new StaleRecordError();

    await recordContentAudit(this.db, {
      actorId,
      entityType: "tv_video",
      entityId: row.id,
      disciplineSlug: row.disciplineSlug,
      action: "update",
      before: before as unknown as Record<string, unknown>,
      after: row as unknown as Record<string, unknown>,
    });

    return toTvVideo(row);
  }

  async delete(id: string, expectedUpdatedAt: string, actorId: string): Promise<void> {
    const expectedDate = new Date(expectedUpdatedAt);
    if (!Number.isFinite(expectedDate.getTime())) throw new InvalidConcurrencyTokenError();

    const [existing] = await this.db.select().from(tvVideos).where(eq(tvVideos.id, id)).limit(1);
    if (!existing) throw new Error(`TV video not found: ${id}`);
    if (existing.updatedAt.getTime() !== expectedDate.getTime()) throw new StaleRecordError();

    await deleteWithOccAudit({
      db: this.db,
      table: tvVideos,
      id,
      entityType: "tv_video",
      expectedDate,
      actorId,
      disciplineSlug: existing.disciplineSlug,
      before: existing as unknown as Record<string, unknown>,
      notFoundMessage: `TV video not found: ${id}`,
    });
  }
}
