import { and, asc, eq, inArray, sql, type SQL } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/postgres-js";
import {
  communitySpotSubmissions,
  countries,
  cities,
  regions,
  sportDisciplines,
  spotTypeAssignments,
  spotDisciplines,
  spotTypes,
  spots,
  type NewSpotRow,
} from "@/db/schema";
import type { SportDiscipline } from "@/types/sport-events";
import type { Spot } from "@/lib/types";
import type {
  ContentDeleteResult,
  MapSpotListResult,
  NewSpot,
  SpotCard,
  SpotFacetCity,
  SpotFacetRegion,
  SpotListResult,
  SpotPatch,
  SpotQuery,
  SpotShuffleFilters,
} from "../core/types";
import type { CountryListResult, SpotRepository } from "./spot-repository";
// `withImageUrls` lives in `@/lib/storage` which imports
// `server-only`. We dynamic-import it inside the read methods that
// actually need it so the static import chain does not pull the
// `server-only` module into CLI scripts (e.g. `pnpm db:seed`) that
// never call a read method.
import {
  joinedSpotSelect,
  mapSpotSelect,
  rowToMapSpotWithImagePath,
  rowToSpotWithImagePath,
  rowToSpotCard,
  spotCardSelect,
} from "./spot-query";
import { decodeSpotCursor, encodeSpotCursor } from "./spot-pagination";
import {
  InvalidReferenceError,
  StaleRecordError,
} from "../core/errors";
import { deleteWithOccAudit } from "../core/occ-delete"
import { detachSpotDependents } from "./spot-delete-plan"
import { recordContentAudit, toAuditJson } from "../admin/content-audit"
import { BaseDrizzleRepository } from "../core/base"
import {
  COMMUNITY_PROMOTION_THRESHOLD,
  COMMUNITY_RADIUS_METERS,
  SPOT_LIST_HARD_CAP,
} from "@/lib/config/constants"

const EARTH_RADIUS_METERS = 6_371_000;

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(a));
}

function sportDisciplineTitleToSlug(title: string): string {
  return title.toLowerCase();
}

export class DrizzleSpotRepository extends BaseDrizzleRepository implements SpotRepository {
  constructor(private readonly db: ReturnType<typeof drizzle>) {
    super()
  }

  /**
   * Filter-only WHERE builder shared by the shuffle ID list. Mirrors the
   * deterministic path's predicates (public visibility default, hidden
   * filtering, type/discipline/country/city/ids/hasImage/search).
   */
  private shuffleFilterConditions(query: SpotShuffleFilters): SQL[] {
    const filterConditions: SQL[] = []
    // Default to public visibility unless explicitly requested (mirrors non-random path)
    if (query.visibility) {
      filterConditions.push(eq(spots.visibility, query.visibility))
    } else if (query.scope !== "created") {
      filterConditions.push(eq(spots.visibility, "public"))
    }
    if (query.adminHidden !== undefined) {
      filterConditions.push(eq(spots.adminHidden, query.adminHidden))
    } else if (!query.includeHidden && query.scope !== "created") {
      filterConditions.push(eq(spots.adminHidden, false))
    }
    if (query.types && query.types.length > 0) {
      const typeList = [...query.types]
      filterConditions.push(sql`exists (
        select 1 from ${spotTypeAssignments} sst
        where sst.spot_id = ${spots.id}
          and sst.type_slug in ${typeList}
      )`)
    }
    if (query.country) filterConditions.push(eq(countries.name, query.country))
    if (query.countryCode) filterConditions.push(eq(spots.countryCode, query.countryCode))
    if (query.discipline) {
      filterConditions.push(sql`exists (
        select 1 from ${spotDisciplines} sd
        where sd.spot_id = ${spots.id}
          and sd.discipline_slug = ${query.discipline.toLowerCase()}
      )`)
    }
    if (query.city) filterConditions.push(eq(spots.citySlug, query.city))
    if (query.ids && query.ids.length > 0) filterConditions.push(inArray(spots.id, [...query.ids]))
    if (query.hasImage) {
      filterConditions.push(
        sql`(${spots.imageUrl} is not null and length(trim(${spots.imageUrl})) > 0)`,
      )
    }
    if (query.q) {
      const like = `%${query.q.toLowerCase()}%`
      filterConditions.push(sql`(
        lower(coalesce(${spots.name}, '')) like ${like}
        or lower(coalesce(${spots.city}, '')) like ${like}
        or lower(coalesce(${spots.address}, '')) like ${like}
      )`)
    }
    return filterConditions
  }

  /**
   * Full filtered ID list for seeded shuffle pagination. Returns IDs
   * only — no rows, no aggregates. The service layer caches this by
   * filter (shared across visitors) and shuffles/slices in memory, so
   * the O(table) scan happens once per filter per cache window instead
   * of once per page view.
   */
  async listShuffledIds(query: SpotShuffleFilters): Promise<string[]> {
    const filterConditions = this.shuffleFilterConditions(query)
    const whereIds =
      filterConditions.length > 0
        ? and(...(filterConditions.filter(Boolean) as SQL[]))
        : undefined
    const idRows = await (whereIds
      ? this.db.select({ id: spots.id }).from(spots).where(whereIds)
      : this.db.select({ id: spots.id }).from(spots))
    return idRows.map((r) => r.id)
  }

  /**
   * Slim card rows for page IDs, in no guaranteed order — the caller
   * restores shuffle order. Five columns plus a per-row sports
   * aggregate (no countries join, no full-table type aggregate).
   */
  async listCardsByIds(ids: readonly string[]): Promise<SpotCard[]> {
    if (ids.length === 0) return []
    const rows = await spotCardSelect(this.db, ids)
    return rows.map(rowToSpotCard)
  }

  private buildListWhere(query?: SpotQuery): SQL | undefined {
    const conditions: SQL[] = [];
    const cursor = decodeSpotCursor(query?.cursor);
    if (cursor) {
      conditions.push(
        sql`(${spots.slug}, ${spots.id}) > (${cursor.slug}, ${cursor.id}::uuid)`,
      );
    }
    // Visibility: default to public for directory reads. Explicit visibility
    // or scope=created bypasses the default so service can fetch owned spots.
    if (query?.visibility) {
      conditions.push(eq(spots.visibility, query.visibility));
    } else if (query?.scope !== "created") {
      conditions.push(eq(spots.visibility, "public"));
    }
    if (query?.adminHidden !== undefined) {
      conditions.push(eq(spots.adminHidden, query.adminHidden));
    } else if (!query?.includeHidden && query?.scope !== "created") {
      conditions.push(eq(spots.adminHidden, false));
    }
    if (query?.origin) conditions.push(eq(spots.origin, query.origin));
    if (query?.types && query.types.length > 0) {
      // OR semantics: a spot matches if any of its types is in the
      // filter set. Single EXISTS subquery against the join table.
      const typeList = [...query.types];
      conditions.push(sql`exists (
         select 1 from ${spotTypeAssignments} sst
        where sst.spot_id = ${spots.id}
          and sst.type_slug in ${typeList}
      )`);
    }
    if (query?.country) conditions.push(eq(countries.name, query.country));
    if (query?.countryCode) conditions.push(eq(spots.countryCode, query.countryCode));
    if (query?.discipline) {
      conditions.push(sql`exists (
        select 1 from ${spotDisciplines} sd
        where sd.spot_id = ${spots.id}
          and sd.discipline_slug = ${query.discipline.toLowerCase()}
      )`);
    }
    if (query?.city) conditions.push(eq(spots.citySlug, query.city));
    if (query?.ids && query.ids.length > 0)
      conditions.push(inArray(spots.id, [...query.ids]));
    if (query?.hasImage) {
      conditions.push(
        sql`(${spots.imageUrl} is not null and length(trim(${spots.imageUrl})) > 0)`,
      );
    }
    if (query?.q) {
      const like = `%${query.q.toLowerCase()}%`;
      conditions.push(sql`(
        lower(coalesce(${spots.name}, '')) like ${like}
        or lower(coalesce(${spots.city}, '')) like ${like}
        or lower(coalesce(${spots.address}, '')) like ${like}
      )`);
    }
    // Geo scope joins the same condition list, NOT a separate
    // `.where()` on the base query: a second `.where()` call (the
    // cursor condition on paged reads) would replace this one and
    // silently un-filter every page after the first.
    if (query?.near) {
      const point = sql`ST_SetSRID(ST_MakePoint(${query.near.lon}, ${query.near.lat}), 4326)::geography`;
      conditions.push(
        sql`ST_DWithin(${spots.location}, ${point}, ${query.near.radiusMeters})`,
      );
    }
    return conditions.length > 0
      ? and(
          ...(conditions
            .map((c) => c as SQL | undefined)
            .filter(Boolean) as SQL[]),
        )
      : undefined;
  }

  async list(query?: SpotQuery): Promise<SpotListResult> {
    // Seeded shuffle pagination lives in the service layer
    // (`listSpotCards`): the ID list is cached by filter and only card
    // columns are fetched per page. Fail fast instead of silently
    // returning deterministic order.
    if (query?.random && query.seed) {
      throw new Error("DrizzleSpotRepository.list: random queries must go through listSpotCards")
    }
    const limit = this.limitClamp(query?.limit ?? SPOT_LIST_HARD_CAP, SPOT_LIST_HARD_CAP);
    const where = this.buildListWhere(query);

    const baseQuery = joinedSpotSelect(this.db);
    const rows = await (where ? baseQuery.where(where) : baseQuery)
      .orderBy(asc(spots.slug), asc(spots.id))
      .limit(limit + 1);

    const pageRows = rows.slice(0, limit);
    const raws = pageRows.map(rowToSpotWithImagePath);
    const { withCardImageUrls } = await import("@/lib/storage");
    let items = await withCardImageUrls(raws);
    if (query?.near) {
      items = items
        .map((s) => ({
          spot: s,
          d: haversineMeters(
            query.near!.lat,
            query.near!.lon,
            s.location.lat,
            s.location.lon,
          ),
        }))
        .sort((a, b) => a.d - b.d)
        .map((x) => x.spot);
    }
    const lastRow = pageRows[pageRows.length - 1];
    const nextCursor =
      rows.length > limit && lastRow
        ? encodeSpotCursor({ slug: lastRow.slug, id: lastRow.id })
        : null;
    return { items, nextCursor };
  }

  async listForMapScope(query?: SpotQuery): Promise<MapSpotListResult> {
    if (query?.random && query.seed) {
      throw new Error("DrizzleSpotRepository.listForMapScope: random queries must go through listSpotCards");
    }
    const limit = this.limitClamp(query?.limit ?? SPOT_LIST_HARD_CAP, SPOT_LIST_HARD_CAP);
    const where = this.buildListWhere(query);

    const baseQuery = mapSpotSelect(this.db);
    const rows = await (where ? baseQuery.where(where) : baseQuery)
      .orderBy(asc(spots.slug), asc(spots.id))
      .limit(limit + 1);

    const pageRows = rows.slice(0, limit);
    const raws = pageRows.map(rowToMapSpotWithImagePath);
    const { withCardImageUrls } = await import("@/lib/storage");
    const items = await withCardImageUrls(raws);
    const lastRow = pageRows[pageRows.length - 1];
    const nextCursor =
      rows.length > limit && lastRow
        ? encodeSpotCursor({ slug: lastRow.slug, id: lastRow.id })
        : null;
    return { items, nextCursor };
  }

  async listCreated(userId: string, query?: SpotQuery): Promise<SpotListResult> {
    const merged: SpotQuery = { ...query, scope: "created" as const }
    const limit = this.limitClamp(merged.limit ?? SPOT_LIST_HARD_CAP, SPOT_LIST_HARD_CAP)
    const conditions: SQL[] = [eq(spots.createdBy, userId)]
    const cursor = decodeSpotCursor(merged.cursor)
    if (cursor) {
      conditions.push(sql`(${spots.slug}, ${spots.id}) > (${cursor.slug}, ${cursor.id}::uuid)`)
    }
    if (merged.types && merged.types.length > 0) {
      const typeList = [...merged.types]
      conditions.push(sql`exists (
         select 1 from ${spotTypeAssignments} sst
        where sst.spot_id = ${spots.id}
          and sst.type_slug in ${typeList}
      )`)
    }
    if (merged.q) {
      const like = `%${merged.q.toLowerCase()}%`
      conditions.push(sql`(
        lower(coalesce(${spots.name}, '')) like ${like}
        or lower(coalesce(${spots.city}, '')) like ${like}
        or lower(coalesce(${spots.address}, '')) like ${like}
      )`)
    }
    const where = conditions.length > 0 ? and(...(conditions as SQL[])) : undefined
    const baseQuery = joinedSpotSelect(this.db)
    const rows = await (where ? baseQuery.where(where) : baseQuery)
      .orderBy(asc(spots.slug), asc(spots.id))
      .limit(limit + 1)
    const pageRows = rows.slice(0, limit)
    const raws = pageRows.map(rowToSpotWithImagePath)
    const { withCardImageUrls } = await import("@/lib/storage")
    const items = await withCardImageUrls(raws)
    const lastRow = pageRows[pageRows.length - 1]
    const nextCursor = rows.length > limit && lastRow ? encodeSpotCursor({ slug: lastRow.slug, id: lastRow.id }) : null
    return { items, nextCursor }
  }

  async findById(id: string): Promise<Spot | null> {
    const rows = await joinedSpotSelect(this.db)
      .where(eq(spots.id, id))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    const { withDetailImageUrls } = await import("@/lib/storage");
    const [spot] = await withDetailImageUrls([rowToSpotWithImagePath(row)]);
    return spot ?? null;
  }

  async findByIdForUser(id: string, userId: string | null): Promise<Spot | null> {
    const spot = await this.findById(id)
    if (!spot) return null
    if (spot.adminHidden) {
      if (userId && spot.createdBy === userId) return spot
      return null
    }
    if (spot.visibility === "public") return spot
    if (userId && spot.createdBy === userId) return spot
    return null
  }

  async findBySlug(slug: string): Promise<Spot | null> {
    const rows = await joinedSpotSelect(this.db)
      .where(eq(spots.slug, slug))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    const { withDetailImageUrls } = await import("@/lib/storage");
    const [spot] = await withDetailImageUrls([rowToSpotWithImagePath(row)]);
    return spot ?? null;
  }

  async findMediaState(id: string): Promise<{ imagePath: string | null } | null> {
    const [row] = await this.db
      .select({ imageUrl: spots.imageUrl })
      .from(spots)
      .where(eq(spots.id, id))
      .limit(1);
    if (!row) return null;
    const { extractStoragePath } = await import("@/lib/storage/variants");
    return { imagePath: extractStoragePath(row.imageUrl) };
  }

  async findNearest(params: {
    lat: number;
    lon: number;
    radiusMeters: number;
    disciplineSlug: string;
    spotTypeSlugs: readonly string[];
  }): Promise<Spot | null> {
    const point = sql`ST_SetSRID(ST_MakePoint(${params.lon}, ${params.lat}), 4326)::geography`;
    const typeSlugs = [...params.spotTypeSlugs];
    if (typeSlugs.length === 0) return null;
    const rows = await joinedSpotSelect(this.db)
      .where(
        and(
          eq(spots.visibility, "public"),
          eq(spots.adminHidden, false),
          sql`ST_DWithin(${spots.location}, ${point}, ${params.radiusMeters})`,
          sql`exists (
            select 1
            from ${spotDisciplines}
            where ${spotDisciplines.spotId} = ${spots.id}
              and ${spotDisciplines.disciplineSlug} = ${params.disciplineSlug}
          )`,
          sql`exists (
            select 1
            from ${spotTypeAssignments}
            where ${spotTypeAssignments.spotId} = ${spots.id}
              and ${inArray(spotTypeAssignments.typeSlug, typeSlugs)}
          )`,
        ),
      )
      .orderBy(sql`ST_Distance(${spots.location}, ${point})`, asc(spots.id))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    const { withCardImageUrls } = await import("@/lib/storage");
    const [spot] = await withCardImageUrls([rowToSpotWithImagePath(row)]);
    return spot ?? null;
  }

  async count(): Promise<number> {
    const [row] = await this.db
      .select({ c: sql<number>`count(*)::int` })
      .from(spots)
      .where(and(eq(spots.visibility, "public"), eq(spots.adminHidden, false)))
    return Number(row?.c ?? 0)
  }

  async countPublic(): Promise<number> {
    const [row] = await this.db
      .select({ c: sql<number>`count(*)::int` })
      .from(spots)
      .where(and(eq(spots.visibility, "public"), eq(spots.adminHidden, false)))
    return Number(row?.c ?? 0)
  }

  async findNearby(params: {
    lat: number;
    lon: number;
    radiusMeters: number;
  }): Promise<readonly Spot[]> {
    const point = sql`ST_SetSRID(ST_MakePoint(${params.lon}, ${params.lat}), 4326)::geography`;
    const rows = await joinedSpotSelect(this.db)
      .where(
        sql`ST_DWithin(${spots.location}, ${point}, ${params.radiusMeters})`,
      )
      .limit(200);
    const { withCardImageUrls } = await import("@/lib/storage");
    return withCardImageUrls(
      rows.map(rowToSpotWithImagePath),
    );
  }

  async findNearbyPublic(params: {
    lat: number;
    lon: number;
    radiusMeters: number;
  }): Promise<readonly Spot[]> {
    const point = sql`ST_SetSRID(ST_MakePoint(${params.lon}, ${params.lat}), 4326)::geography`;
    const rows = await joinedSpotSelect(this.db)
      .where(
        and(
          sql`ST_DWithin(${spots.location}, ${point}, ${params.radiusMeters})`,
          eq(spots.visibility, "public"),
          eq(spots.adminHidden, false),
        ),
      )
      .limit(200);
    const { withCardImageUrls } = await import("@/lib/storage");
    return withCardImageUrls(rows.map(rowToSpotWithImagePath));
  }

  async listCountries(): Promise<
    readonly { name: string; region: string; count: number }[]
  > {
    const rows = await this.db.execute<{
      country: string;
      region: string;
      count: string;
    }>(sql`
       select c.name as country, r.name as region, count(*)::int as count
       from ${spots} s
       join ${countries} c on c.iso2 = s.country_code
       join ${regions} r on r.id = c.region_id
       where s.visibility = 'public' and s.admin_hidden = false
       group by c.name, r.name
      order by c.name
    `);
    return rows.map((r) => ({
      name: r.country,
      region: r.region,
      count: Number(r.count),
    }));
  }

  async listCountriesForRegion(
    region: string,
  ): Promise<readonly { name: string; count: number }[]> {
    // Push filter into DB — avoids loading all countries + all spot counts
    // on every region tab. Uses `regions.name` index via `countries_region_idx`.
    const rows = await this.db.execute<{
      country: string;
      count: string;
    }>(sql`
       select c.name as country, count(*)::int as count
       from ${spots} s
       join ${countries} c on c.iso2 = s.country_code
       join ${regions} r on r.id = c.region_id
       where r.name = ${region} and s.visibility = 'public' and s.admin_hidden = false
       group by c.name
       order by c.name
     `);
    return rows.map((r) => ({ name: r.country, count: Number(r.count) }));
  }

  async listTypes(): Promise<readonly { name: string; count: number }[]> {
    // Group by type via the join table. A spot with two types
    // contributes one count to each of its type rows. We constrain
    // to the `spot_types.sort_order` ordering by joining the
    // dimension table.
    const rows = await this.db.execute<{ type: string; count: string }>(sql`
      select st.name as type, count(*)::int as count
       from ${spotTypeAssignments} sst
      join ${spotTypes} st on st.slug = sst.type_slug
      join ${spots} s on s.id = sst.spot_id and s.visibility = 'public' and s.admin_hidden = false
      group by st.name, st.sort_order
      order by st.sort_order, st.name
    `);
    return rows.map((r) => ({
      name: r.type,
      count: Number(r.count),
    }));
  }

  async listAllSpotTypes(): Promise<
    readonly { slug: string; name: string; sortOrder: number }[]
  > {
    const rows = await this.db
      .select({
        slug: spotTypes.slug,
        name: spotTypes.name,
        sortOrder: spotTypes.sortOrder,
      })
      .from(spotTypes)
      .orderBy(asc(spotTypes.sortOrder), asc(spotTypes.name));
    return rows;
  }

  async listAllCountries(): Promise<CountryListResult> {
    const rows = await this.db
      .select({
        iso2: countries.iso2,
        name: countries.name,
        region: regions.name,
      })
      .from(countries)
      .innerJoin(regions, eq(regions.id, countries.regionId))
      .orderBy(asc(countries.name));
    const countryIso2ByName: Record<string, string> = {};
    for (const row of rows) {
      countryIso2ByName[row.name] = row.iso2;
    }
    return { items: rows, countryIso2ByName };
  }

  async listRegions(): Promise<readonly SpotFacetRegion[]> {
    // Rollup in a derived table (countries with their public spot counts),
    // then aggregate to regions and attach the per-country drill-down as
    // JSON. Two levels of aggregation keep the aggregate calls unnested.
    // The driver parses `json_agg` output into objects; other drivers
    // may leave it as text, so the mapping normalizes both shapes.
    const rows = await this.db.execute<{
      region: string;
      country_count: string;
      spot_count: string;
      by_country: readonly { name: string; count: number }[] | string;
    }>(sql`
      select
        r.name as region,
        count(*)::int as country_count,
        sum(c.spot_count)::int as spot_count,
        coalesce(
          json_agg(
            json_build_object('name', c.name, 'count', c.spot_count)
            order by c.name
          ),
          '[]'::json
        ) as by_country
      from (
        select
          cc.iso2 as country_id,
          cc.name,
          cc.region_id,
          count(s.id)::int as spot_count
        from ${countries} cc
        left join ${spots} s on s.country_code = cc.iso2 and s.visibility = 'public' and s.admin_hidden = false
        group by cc.iso2, cc.name, cc.region_id
      ) c
      join ${regions} r on r.id = c.region_id
      group by r.name
    `);
    return rows.map((r) => {
      const raw = r.by_country;
      const byCountry =
        typeof raw === "string"
          ? (JSON.parse(raw) as readonly { name: string; count: number }[])
          : raw ?? [];
      return {
        name: r.region,
        countryCount: Number(r.country_count),
        spotCount: Number(r.spot_count),
        byCountry,
      };
    });
  }

  async listCitiesForCountry(country: string): Promise<readonly SpotFacetCity[]> {
    // Count is ordering-only (never shipped): the facet carries the display
    // name and the canonical city slug, ordered by true spot volume.
    const rows = await this.db.execute<{
      slug: string;
      name: string;
    }>(sql`
      select
        s.city_slug as slug,
        min(s.city) as name
      from ${spots} s
      join ${countries} c on c.iso2 = s.country_code
      where c.name = ${country}
        and s.visibility = 'public'
        and s.admin_hidden = false
        and s.city_slug <> ''
      group by s.city_slug
      order by count(*) desc, min(s.city) asc
    `);
    return rows.map((row) => ({
      slug: row.slug,
      name: row.name,
    }));
  }

  private async syncSpotDisciplines(
    spotId: string,
    disciplines: readonly SportDiscipline[],
  ): Promise<void> {
    await this.db.delete(spotDisciplines).where(eq(spotDisciplines.spotId, spotId));
    if (disciplines.length === 0) return;
    const slugs = disciplines.map(sportDisciplineTitleToSlug);
    await this.db
      .insert(spotDisciplines)
      .values(slugs.map((disciplineSlug) => ({ spotId, disciplineSlug })));
  }

  private async syncSpotTypes(
    spotId: string,
    typeSlugs: readonly string[],
  ): Promise<void> {
    await this.db.delete(spotTypeAssignments).where(eq(spotTypeAssignments.spotId, spotId));
    if (typeSlugs.length === 0) return;
    const normalized = typeSlugs
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0);
    const unique = Array.from(new Set(normalized));
    if (unique.length === 0) return;
    await this.db
      .insert(spotTypeAssignments)
      .values(unique.map((typeSlug) => ({ spotId, typeSlug })));
  }

  private async assertReferenceIntegrity(
    countryCode: string,
    disciplines: readonly string[],
    typeSlugs: readonly string[],
    requireDiscipline = false,
  ): Promise<void> {
    const country = await this.db
      .select({ iso2: countries.iso2 })
      .from(countries)
      .where(eq(countries.iso2, countryCode))
      .limit(1);
    if (!country[0]) {
      throw new InvalidReferenceError(`Country not found: ${countryCode}`);
    }

    const disciplineSlugs = Array.from(
      new Set(disciplines.map((discipline) => discipline.toLowerCase())),
    );
    if (requireDiscipline && disciplineSlugs.length === 0) {
      throw new InvalidReferenceError("A spot must have at least one sport discipline");
    }
    if (disciplineSlugs.length > 0) {
      const rows = await this.db
        .select({ slug: sportDisciplines.slug })
        .from(sportDisciplines)
        .where(inArray(sportDisciplines.slug, disciplineSlugs));
      const found = new Set(rows.map((row) => row.slug));
      const missing = disciplineSlugs.filter((slug) => !found.has(slug));
      if (missing.length > 0) {
        throw new InvalidReferenceError(
          `Sport discipline not found: ${missing.join(", ")}`,
        );
      }
    }

    const normalizedTypes = Array.from(
      new Set(
        typeSlugs
          .map((slug) => slug.trim().toLowerCase())
          .filter((slug) => slug.length > 0),
      ),
    );
    if (normalizedTypes.length > 0) {
      const rows = await this.db
        .select({ slug: spotTypes.slug })
        .from(spotTypes)
        .where(inArray(spotTypes.slug, normalizedTypes));
      const found = new Set(rows.map((row) => row.slug));
      const missing = normalizedTypes.filter((slug) => !found.has(slug));
      if (missing.length > 0) {
        throw new InvalidReferenceError(
          `Spot type not found: ${missing.join(", ")}`,
        );
      }
    }
  }

  /**
   * Inserts (or updates on slug conflict) the spot row, then syncs
   * the sport- and type-join tables. Returns the row's real `id` —
   * on a re-seed the freshly-generated `id` in `insertValues` is
   * discarded by the upsert, so we read it back from `.returning()`.
   * Shared by `create` (which then reloads) and `upsertBySlug` (which
   * returns the id without reloading).
   */
  private async upsertAndSync(
    input: NewSpot,
    insertValues: NewSpotRow,
  ): Promise<string> {
    await this.assertReferenceIntegrity(
      insertValues.countryCode,
      input.sports,
      input.types,
      true,
    );
    const [row] = await this.db
      .insert(spots)
      .values(insertValues)
      .onConflictDoUpdate({
        target: spots.slug,
        set: {
          name: insertValues.name,
          city: insertValues.city,
          citySlug: insertValues.citySlug,
          address: insertValues.address,
          imageUrl: insertValues.imageUrl,
          countryCode: insertValues.countryCode,
          instagram: insertValues.instagram,
          location: insertValues.location,
          // Re-seeding or an upsert must never transfer ownership from an
          // existing administrator to the importing caller.
          createdBy: sql`${spots.createdBy}`,
          updatedBy: sql`${spots.updatedBy}`,
          updatedAt: new Date(),
        },
      })
      .returning({ id: spots.id });
    const rowId = row?.id;
    if (!rowId) throw new Error("Insert returned no row");
    if (insertValues.citySlug && insertValues.city) {
      await this.db
        .insert(cities)
        .values({
          countryCode: insertValues.countryCode,
          slug: insertValues.citySlug,
          name: insertValues.city,
          sortOrder: 0,
        })
        .onConflictDoNothing();
    }
    await this.syncSpotDisciplines(rowId, input.sports);
    await this.syncSpotTypes(rowId, input.types);
    return rowId;
  }

  /**
   * Builds the `insertValues` for a spot from a `NewSpot` input. The
   * slug defaults to `citySlug-<timestamp>` (each call gets a unique
   * slug, used by the user-facing create flow); pass `input.slug` to
   * pin it (used by the seed, which needs a stable upsert key across
   * re-seeds).
   */
  private async buildInsertValues(input: NewSpot): Promise<NewSpotRow> {
    const countryCode = input.countryCode
      ? input.countryCode
      : (await this.db
          .select({ iso2: countries.iso2 })
          .from(countries)
          .where(eq(countries.name, input.country))
          .limit(1))[0]?.iso2;
    if (!countryCode) {
      throw new InvalidReferenceError(`Country not found: ${input.country}`);
    }

    return {
      id: input.id ?? crypto.randomUUID(),
      slug: input.slug ?? `${input.citySlug}-${Date.now()}`,
      name: input.name.toUpperCase(),
      city: input.city,
      citySlug:
        input.citySlug ?? input.city.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      address: input.address,
      imageUrl: input.image,
      countryCode,
      instagram: input.instagram ?? null,
      location: input.location,
      visibility: "public",
      origin: "seed",
      communitySubmissionCount: 0,
      adminHidden: false,
      createdBy: input.createdBy,
      updatedBy: input.createdBy,
    };
  }

  private async auditSnapshot(id: string): Promise<Record<string, unknown> | null> {
    const [row] = await this.db
      .select()
      .from(spots)
      .where(eq(spots.id, id))
      .limit(1);
    if (!row) return null;
    // No ORDER BY — audit correctness does not require sorted sports/types,
    // and sorting adds an unnecessary Sort node per mutation tail.
    const disciplines = await this.db
      .select({ slug: spotDisciplines.disciplineSlug })
      .from(spotDisciplines)
      .where(eq(spotDisciplines.spotId, id));
    const types = await this.db
      .select({ slug: spotTypeAssignments.typeSlug })
      .from(spotTypeAssignments)
      .where(eq(spotTypeAssignments.spotId, id));
    return toAuditJson({
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      sports: disciplines.map((discipline) => discipline.slug),
      types: types.map((type) => type.slug),
    }) as Record<string, unknown>;
  }

  async create(input: NewSpot): Promise<Spot> {
    const insertValues = await this.buildInsertValues(input);
    const [existing] = await this.db
      .select({ id: spots.id })
      .from(spots)
      .where(eq(spots.slug, insertValues.slug))
      .limit(1);
    const before = existing ? await this.auditSnapshot(existing.id) : null;
    const rowId = await this.upsertAndSync(input, insertValues);
    const after = await this.auditSnapshot(rowId);
    await recordContentAudit(this.db, {
      actorId: input.createdBy,
      entityType: "spot",
      entityId: rowId,
      action: before ? "update" : "create",
      before,
      after,
      disciplineSlug: input.sports.length === 1
        ? sportDisciplineTitleToSlug(input.sports[0]!)
        : null,
    });
    const reloaded = await this.findById(rowId);
    if (!reloaded) throw new Error("Spot not found after insert");
    return reloaded;
  }

  async createPersonal(input: NewSpot, opts: { submissionHash: string }): Promise<Spot> {
    const submissionHash = opts.submissionHash
    if (!input.createdBy) throw new Error("createPersonal requires createdBy")
    // Idempotency: same user + same hash returns existing spot
    const existingSub = await this.db
      .select({ canonicalSpotId: communitySpotSubmissions.canonicalSpotId })
      .from(communitySpotSubmissions)
      .where(and(eq(communitySpotSubmissions.userId, input.createdBy), eq(communitySpotSubmissions.submissionHash, submissionHash)))
      .limit(1)
    if (existingSub[0]?.canonicalSpotId) {
      const existingSpot = await this.findById(existingSub[0].canonicalSpotId)
      if (existingSpot) return existingSpot
    }

    const insertValues = await this.buildInsertValues(input)
    // Override to personal/community_personal
    ;(insertValues as Record<string, unknown>).visibility = "personal"
    ;(insertValues as Record<string, unknown>).origin = "user_personal"
    ;(insertValues as Record<string, unknown>).communitySubmissionCount = 0
    ;(insertValues as Record<string, unknown>).adminHidden = false

    const rowId = await this.upsertAndSync(input, insertValues as NewSpotRow)

    // Insert submission ledger (ignore if race inserted same hash)
    await this.db
      .insert(communitySpotSubmissions)
      .values({
        userId: input.createdBy,
        canonicalSpotId: rowId,
        location: input.location,
        submissionHash,
      })
      .onConflictDoNothing()

    // Serialize promotions per hash to avoid concurrent double-promotes
    await this.db.execute(sql`select pg_advisory_xact_lock(hashtext(${submissionHash}))`)

    const point = sql`ST_SetSRID(ST_MakePoint(${input.location.lon}, ${input.location.lat}), 4326)::geography`
    const countRows = await this.db.execute<{ cnt: string }>(
      sql`select count(distinct css.user_id)::int as cnt from ${communitySpotSubmissions} css join ${spots} s on s.id = css.canonical_spot_id where ST_DWithin(css.location, ${point}, ${COMMUNITY_RADIUS_METERS}) and s.admin_hidden = false`,
    )
    const distinctCount = Number(countRows[0]?.cnt ?? 0)

    if (distinctCount >= COMMUNITY_PROMOTION_THRESHOLD) {
      await this.db.execute(sql`
        update ${spots}
        set visibility = 'public',
            origin = 'community',
            community_submission_count = ${distinctCount},
            updated_at = now()
        where id in (
          select css.canonical_spot_id from ${communitySpotSubmissions} css join ${spots} s on s.id = css.canonical_spot_id
          where ST_DWithin(css.location, ${point}, ${COMMUNITY_RADIUS_METERS})
            and css.canonical_spot_id is not null
            and s.admin_hidden = false
        )
      `)
    } else {
      await this.db.update(spots).set({ communitySubmissionCount: distinctCount }).where(eq(spots.id, rowId))
    }

    const after = await this.auditSnapshot(rowId)
    await recordContentAudit(this.db, {
      actorId: input.createdBy,
      entityType: "spot",
      entityId: rowId,
      action: "create",
      before: null,
      after,
      disciplineSlug: input.sports.length === 1 ? sportDisciplineTitleToSlug(input.sports[0]!) : null,
    })

    const reloaded = await this.findById(rowId)
    if (!reloaded) throw new Error("Spot not found after insert")
    return reloaded
  }

  /**
   * Upsert a spot by slug and sync its join tables. Returns the row
   * id without reloading the full Spot (no storage / image-URL
   * round-trip). Used by the seed, which doesn't consume the joined
   * data — it only needs the row to exist.
   */
  async upsertBySlug(input: NewSpot): Promise<{ id: string }> {
    if (!input.slug) {
      throw new Error("upsertBySlug requires input.slug");
    }
    const insertValues = await this.buildInsertValues(input);
    const id = await this.upsertAndSync(input, insertValues);
    return { id };
  }

  async update(
    id: string,
    patch: SpotPatch,
    expectedUpdatedAt?: string,
    actorId?: string | null,
  ): Promise<Spot> {
    const expectedDate = this.parseExpectedUpdatedAt(expectedUpdatedAt);
    const before = await this.auditSnapshot(id);
    const [current] = await this.db
      .select({ countryCode: spots.countryCode, updatedAt: spots.updatedAt })
      .from(spots)
      .where(eq(spots.id, id))
      .limit(1);
    if (!current) throw new Error(`Spot not found: ${id}`);
    // OCC is enforced by the `WHERE updatedAt = expectedDate` clause below.
    // `spots.updated_at` is `timestamp(3) with time zone` (ms precision, see
    // `src/db/schema.ts` and `0004_timestamp_precision.sql`), matching JS `Date`
    // / `toISOString()` ms precision. No `date_trunc` per query – efficient,
    // index-friendly and scalable. An early `getTime()` check would be racy,
    // so we rely on the atomic UPDATE result (0 rows → StaleRecordError).

    const setValues: Partial<NewSpotRow> = {
      updatedAt: new Date(),
    };
    if (patch.name !== undefined) setValues.name = patch.name.toUpperCase();
    if (patch.city !== undefined) setValues.city = patch.city;
    if (patch.citySlug !== undefined) setValues.citySlug = patch.citySlug;
    if (patch.address !== undefined) setValues.address = patch.address;
    if (patch.image !== undefined) {
      setValues.imageUrl = patch.image;
    }
    // imagePath is obsolete — derived from imageUrl
    let countryCode = current.countryCode;
    if (patch.countryCode !== undefined) {
      setValues.countryCode = patch.countryCode;
      countryCode = patch.countryCode;
    } else if (patch.country !== undefined) {
      const [country] = await this.db
        .select({ iso2: countries.iso2 })
        .from(countries)
        .where(eq(countries.name, patch.country))
        .limit(1);
      if (!country) {
        throw new InvalidReferenceError(`Country not found: ${patch.country}`);
      }
      setValues.countryCode = country.iso2;
      countryCode = country.iso2;
    }
    if (patch.instagram !== undefined) setValues.instagram = patch.instagram;
    if (patch.location !== undefined)
      setValues.location = patch.location;

    const currentDisciplines = await this.db
      .select({ slug: spotDisciplines.disciplineSlug })
      .from(spotDisciplines)
      .where(eq(spotDisciplines.spotId, id));
    await this.assertReferenceIntegrity(
      countryCode,
      patch.sports ?? currentDisciplines.map((discipline) => discipline.slug),
      patch.types ?? [],
      true,
    );
    if (actorId !== undefined) setValues.updatedBy = actorId;

    const where = expectedDate
      ? and(eq(spots.id, id), eq(spots.updatedAt, expectedDate))
      : eq(spots.id, id);
    const [row] = await this.db
      .update(spots)
      .set(setValues)
      .where(where)
      .returning();
    if (!row) {
      throw expectedDate
        ? new StaleRecordError()
        : new Error(`Spot not found: ${id}`);
    }
    if (patch.sports !== undefined) {
      await this.syncSpotDisciplines(id, patch.sports);
    }
    if (patch.types !== undefined) {
      await this.syncSpotTypes(id, patch.types);
    }
    const after = await this.auditSnapshot(id);
    await recordContentAudit(this.db, {
      actorId,
      entityType: "spot",
      entityId: id,
      action: "update",
      before,
      after,
      disciplineSlug: patch.sports?.length === 1
        ? sportDisciplineTitleToSlug(patch.sports[0]!)
        : null,
    });
    const reloaded = await this.findById(id);
    if (!reloaded) throw new Error(`Spot not found: ${id}`);
    return reloaded;
  }

  async delete(
    id: string,
    expectedUpdatedAt?: string,
    actorId?: string | null,
  ): Promise<ContentDeleteResult> {
    const before = await this.auditSnapshot(id);
    if (!before) throw new Error(`Spot not found: ${id}`);
    // Moderation hard-delete for every origin: user/community spots are no
    // longer diverted to `hideSpot` here (explicit hide lives in
    // `hideSpot`/`hideCluster`). Game history is detached with snapshots
    // instead of destroyed — see `detachSpotDependents`.
    const expectedDate = this.parseExpectedUpdatedAt(expectedUpdatedAt);
    const rawImage =
      typeof (before as Record<string, unknown>).imageUrl === "string"
        ? ((before as Record<string, unknown>).imageUrl as string)
        : typeof (before as Record<string, unknown>).imagePath === "string"
          ? ((before as Record<string, unknown>).imagePath as string)
          : null;
    const { extractStoragePath } = await import("@/lib/storage/variants");
    const imagePath = rawImage ? extractStoragePath(rawImage) : null;
    const record = before as Record<string, unknown>;
    const detachSummary = await detachSpotDependents(this.db, id, {
      name:
        typeof record.name === "string" && record.name.length > 0
          ? record.name
          : "Removed spot",
      city: typeof record.city === "string" ? record.city : "",
      slug: typeof record.slug === "string" ? record.slug : "",
    });
    await deleteWithOccAudit({
      db: this.db,
      table: spots,
      id,
      entityType: "spot",
      expectedDate,
      actorId,
      before,
      notFoundMessage: `Spot not found: ${id}`,
      metadata: { moderation: "hard_delete", detach: detachSummary },
    });
    return { imagePath, detachSummary };
  }

  async hideSpot(
    id: string,
    expectedUpdatedAt?: string,
    actorId?: string | null,
  ): Promise<{ imagePath: string | null; hidden?: boolean }> {
    const expectedDate = this.parseExpectedUpdatedAt(expectedUpdatedAt);
    const before = await this.auditSnapshot(id);
    if (!before) throw new Error(`Spot not found: ${id}`);
    const beforeHidden = Boolean((before as Record<string, unknown>).adminHidden);
    if (beforeHidden) return { imagePath: null, hidden: true };
    const where = expectedDate
      ? and(eq(spots.id, id), eq(spots.updatedAt, expectedDate))
      : eq(spots.id, id);
    const [row] = await this.db
      .update(spots)
      .set({ adminHidden: true, updatedAt: new Date(), updatedBy: actorId ?? sql`${spots.updatedBy}` })
      .where(where)
      .returning({ id: spots.id });
    if (!row) {
      if (expectedDate) {
        const [existing] = await this.db.select({ id: spots.id }).from(spots).where(eq(spots.id, id)).limit(1);
        if (existing) throw new StaleRecordError();
      }
      throw new Error(`Spot not found: ${id}`);
    }
    const after = await this.auditSnapshot(id);
    await recordContentAudit(this.db, {
      actorId,
      entityType: "spot",
      entityId: id,
      action: "update",
      before,
      after,
      metadata: { moderation: "hide", origin: (before as Record<string, unknown>).origin },
    });
    // Keep image (owner still sees private); do not return imagePath for deletion
    return { imagePath: null, hidden: true };
  }

  async hideCluster(
    id: string,
    expectedUpdatedAt?: string,
    actorId?: string | null,
  ): Promise<{ hiddenSpotIds: readonly string[]; hiddenCount: number }> {
    const expectedDate = this.parseExpectedUpdatedAt(expectedUpdatedAt);
    const before = await this.auditSnapshot(id);
    if (!before) throw new Error(`Spot not found: ${id}`);
    // OCC on canonical
    if (expectedDate) {
      const expectedIso = expectedDate.toISOString();
      const beforeUpdated = (before as Record<string, unknown>).updatedAt as string | undefined;
      // auditSnapshot stores updatedAt as ISO string; compare for staleness
      if (beforeUpdated && new Date(beforeUpdated).toISOString() !== expectedIso) {
        // Still need DB check for race; fetch row
        const [current] = await this.db.select({ updatedAt: spots.updatedAt }).from(spots).where(eq(spots.id, id)).limit(1);
        if (current && current.updatedAt.toISOString() !== expectedIso) throw new StaleRecordError();
      }
    }
    const location = (before as Record<string, unknown>).location as { lat: number; lon: number } | undefined;
    if (!location || typeof location.lat !== "number" || typeof location.lon !== "number") {
      // Fallback to single hide if location missing
      await this.hideSpot(id, expectedUpdatedAt, actorId);
      return { hiddenSpotIds: [id], hiddenCount: 1 };
    }
    const point = sql`ST_SetSRID(ST_MakePoint(${location.lon}, ${location.lat}), 4326)::geography`;
    // Serialize cluster hides per 300m cell
    const hash = `${location.lat.toFixed(3)}:${location.lon.toFixed(3)}`;
    await this.db.execute(sql`select pg_advisory_xact_lock(hashtext(${hash}))`);
    const clusterRows = await this.db.execute<{ id: string }>(
      sql`select ${spots.id} as id from ${spots} where ST_DWithin(${spots.location}, ${point}, ${COMMUNITY_RADIUS_METERS}) and ${spots.adminHidden} = false`,
    );
    const ids = clusterRows.map((r) => r.id);
    if (ids.length === 0) return { hiddenSpotIds: [], hiddenCount: 0 };
    // Ensure canonical is included even if its admin_hidden was set concurrently
    if (!ids.includes(id)) ids.push(id);
    await this.db.update(spots).set({ adminHidden: true, updatedAt: new Date() }).where(inArray(spots.id, ids));
    // Audit each
    for (const clusterId of ids) {
      const snapAfter = await this.auditSnapshot(clusterId);
      await recordContentAudit(this.db, {
        actorId,
        entityType: "spot",
        entityId: clusterId,
        action: "update",
        before: clusterId === id ? before : null,
        after: snapAfter,
        metadata: { moderation: "hide_cluster", canonicalId: id },
      });
    }
    return { hiddenSpotIds: ids, hiddenCount: ids.length };
  }

  async unhideSpot(
    id: string,
    expectedUpdatedAt?: string,
    actorId?: string | null,
  ): Promise<{ imagePath: string | null; hidden?: boolean }> {
    const expectedDate = this.parseExpectedUpdatedAt(expectedUpdatedAt);
    const before = await this.auditSnapshot(id);
    if (!before) throw new Error(`Spot not found: ${id}`);
    const where = expectedDate
      ? and(eq(spots.id, id), eq(spots.updatedAt, expectedDate))
      : eq(spots.id, id);
    const [row] = await this.db
      .update(spots)
      .set({ adminHidden: false, updatedAt: new Date(), updatedBy: actorId ?? sql`${spots.updatedBy}` })
      .where(where)
      .returning({ id: spots.id });
    if (!row) {
      if (expectedDate) {
        const [existing] = await this.db.select({ id: spots.id }).from(spots).where(eq(spots.id, id)).limit(1);
        if (existing) throw new StaleRecordError();
      }
      throw new Error(`Spot not found: ${id}`);
    }
    const after = await this.auditSnapshot(id);
    await recordContentAudit(this.db, {
      actorId,
      entityType: "spot",
      entityId: id,
      action: "update",
      before,
      after,
      metadata: { moderation: "unhide" },
    });
    return { imagePath: null, hidden: false };
  }
}
