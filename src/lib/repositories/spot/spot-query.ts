import { eq, inArray, sql, type SQL } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/postgres-js";
import {
  countries,
  spotTypeAssignments,
  spotDisciplines,
  sportDisciplines,
  spots,
  spotTypes,
} from "@/db/schema";
import type { SportDiscipline } from "@/types/sport-events";
import type { MapSpot, Spot, SpotLocation, SpotTypeRef } from "@/lib/types";
import type { SpotCard } from "../core/types";
import type { SpotWithImagePath } from "@/lib/storage";
import { extractStoragePath } from "@/lib/storage/variants";

/**
 * Aggregates the spot's type tags into a denormalized `{slug, name}[]`
 * ordered by the type dimension's `sort_order` then `name`. Each row
 * is a `json` object (Postgres `json_build_object`), so the driver
 * returns the array as a list of plain objects.
 *
 * The previous implementation was a correlated subquery that re-ran
 * the aggregate for every row in the outer spots query. With
 * `SPOT_LIST_HARD_CAP = 500` that hit the 8s server
 * `statement_timeout` (`57014 canceling statement due to statement
 * timeout`). Aggregating once into a derived table and LEFT JOINing
 * back is O(N) — one pass per join table — instead of O(N²).
 */
function typesAggregated(db: ReturnType<typeof drizzle>) {
  return db
    .select({
       spotId: spotTypeAssignments.spotId,
      types: sql<SpotTypeRef[]>`
        array_agg(
          json_build_object('slug', ${spotTypes.slug}, 'name', ${spotTypes.name})
          order by ${spotTypes.sortOrder}, ${spotTypes.name}
        )
      `.as("types"),
    })
     .from(spotTypeAssignments)
     .innerJoin(spotTypes, eq(spotTypes.slug, spotTypeAssignments.typeSlug))
     .groupBy(spotTypeAssignments.spotId)
    .as("types_agg");
}

function sportsAggregated(db: ReturnType<typeof drizzle>) {
  return db
    .select({
       spotId: spotDisciplines.spotId,
      sports: sql<string[]>`
        array_agg(${sportDisciplines.name} order by ${sportDisciplines.name})
      `.as("sports"),
    })
     .from(spotDisciplines)
    .innerJoin(
      sportDisciplines,
       eq(sportDisciplines.slug, spotDisciplines.disciplineSlug),
    )
     .groupBy(spotDisciplines.spotId)
    .as("sports_agg");
}

export interface MapSpotRow {
  id: string;
  slug: string;
  name: string;
  city: string;
  citySlug: string;
  types: SpotTypeRef[];
  sports: string[];
  imageUrl: string | null;
  country: string;
  countryCode: string;
  instagram: string | null;
  verificationCount: number;
  location: SpotLocation;
}

export interface JoinedSpotRow extends MapSpotRow {
  address: string;
  visibility: string;
  origin: string;
  communitySubmissionCount: number;
  adminHidden: boolean;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * `COALESCE(..., '{}'::json[])` on the LEFT JOINed aggregates keeps
 * the row shape stable for spots with no types or no sports — the
 * correlated-subquery form produced an empty array via the inner
 * `coalesce(..., '{}'::json[])`; the joined form produces NULL when
 * the spot has no rows in the join table, which `COALESCE` folds to
 * the same empty array. The result type is unchanged for callers.
 *
 * The aggregate references are written as raw qualified names
 * (`"types_agg"."types"`) rather than `${typesAgg.types}`: Drizzle
 * renders subquery fields inside `sql` templates UNQUALIFIED, and since
 * migration 0034 the underlying `spots` table itself has a `types`
 * jsonb column (and `sports` text[]) for the read model, which made the
 * bare references ambiguous (Postgres 42702 — every list query failed).
 */
const emptyTypes: SQL = sql`'{}'::json[]`;
const emptySports: SQL = sql`'{}'::text[]`;

export function mapSpotSelect(db: ReturnType<typeof drizzle>) {
  const typesAgg = typesAggregated(db);
  const sportsAgg = sportsAggregated(db);
  return db
    .select({
      id: spots.id,
      slug: spots.slug,
      name: spots.name,
      city: spots.city,
      citySlug: spots.citySlug,
      types: sql<SpotTypeRef[]>`coalesce("types_agg"."types", ${emptyTypes})`,
      sports: sql<string[]>`coalesce("sports_agg"."sports", ${emptySports})`,
      imageUrl: spots.imageUrl,
      country: countries.name,
      countryCode: spots.countryCode,
      instagram: spots.instagram,
      verificationCount: spots.verificationCount,
      location: spots.location,
    })
    .from(spots)
    .innerJoin(countries, eq(countries.iso2, spots.countryCode))
    .leftJoin(typesAgg, eq(typesAgg.spotId, spots.id))
    .leftJoin(sportsAgg, eq(sportsAgg.spotId, spots.id))
    .$dynamic();
}

export function rowToMapSpot(row: MapSpotRow): MapSpot {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    city: row.city,
    citySlug: row.citySlug,
    types: row.types ?? [],
    sports: (row.sports ?? []) as readonly SportDiscipline[],
    image: row.imageUrl ?? "",
    country: row.country,
    countryCode: row.countryCode ?? "",
    instagram: row.instagram,
    verificationCount: row.verificationCount ?? 0,
    location: row.location,
  };
}

export function rowToMapSpotWithImagePath(row: MapSpotRow): SpotWithImagePath<MapSpot> {
  return { spot: rowToMapSpot(row), imagePath: extractStoragePath(row.imageUrl) };
}

export function joinedSpotSelect(db: ReturnType<typeof drizzle>) {
  const typesAgg = typesAggregated(db);
  const sportsAgg = sportsAggregated(db);
  return db
    .select({
      id: spots.id,
      slug: spots.slug,
      name: spots.name,
      city: spots.city,
      citySlug: spots.citySlug,
      address: spots.address,
      types: sql<SpotTypeRef[]>`coalesce("types_agg"."types", ${emptyTypes})`,
      sports: sql<string[]>`coalesce("sports_agg"."sports", ${emptySports})`,
      imageUrl: spots.imageUrl,
      country: countries.name,
      countryCode: spots.countryCode,
      instagram: spots.instagram,
      verificationCount: spots.verificationCount,
      visibility: spots.visibility,
      origin: spots.origin,
      communitySubmissionCount: spots.communitySubmissionCount,
      adminHidden: spots.adminHidden,
      location: spots.location,
      createdBy: spots.createdBy,
      createdAt: spots.createdAt,
      updatedAt: spots.updatedAt,
    })
    .from(spots)
    .innerJoin(countries, eq(countries.iso2, spots.countryCode))
    .leftJoin(typesAgg, eq(typesAgg.spotId, spots.id))
    .leftJoin(sportsAgg, eq(sportsAgg.spotId, spots.id))
    .$dynamic();
}

export function rowToSpot(row: JoinedSpotRow): Spot {
  return {
    ...rowToMapSpot(row),
    address: row.address,
    visibility: (row.visibility as Spot["visibility"]) ?? "public",
    origin: (row.origin as Spot["origin"]) ?? "seed",
    communitySubmissionCount: row.communitySubmissionCount ?? 0,
    adminHidden: Boolean(row.adminHidden),
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function rowToSpotWithImagePath(row: JoinedSpotRow): SpotWithImagePath {
  return { spot: rowToSpot(row), imagePath: extractStoragePath(row.imageUrl) };
}

export interface SpotCardRow {
  id: string;
  name: string;
  city: string;
  imageUrl: string | null;
  sports: string[];
}

/**
 * Slim card projection for the landing wire: 5 columns plus a
 * per-row sports aggregate. Unlike `joinedSpotSelect` it skips the
 * countries join and the full-table type aggregate — the caller
 * restricts to page IDs, so the correlated sports subquery runs once
 * per card row instead of once per table.
 */
export function spotCardSelect(db: ReturnType<typeof drizzle>, ids: readonly string[]) {
  return db
    .select({
      id: spots.id,
      name: spots.name,
      city: spots.city,
      imageUrl: spots.imageUrl,
      sports: sql<string[]>`
        coalesce(
          (
            select array_agg(${sportDisciplines.name} order by ${sportDisciplines.name})
            from ${spotDisciplines} sd
            join ${sportDisciplines} sdn on sdn.slug = sd.discipline_slug
            where sd.spot_id = ${spots.id}
          ),
          '{}'::text[]
        )
      `.as("sports"),
    })
    .from(spots)
    .where(inArray(spots.id, [...ids]));
}

export function rowToSpotCard(row: SpotCardRow): SpotCard {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    // Same normalization as `rowToSpot`: NULL/'' renders no image and
    // the card falls back to its kind placeholder.
    image: row.imageUrl ?? "",
    sports: (row.sports ?? []) as readonly SportDiscipline[],
  };
}
