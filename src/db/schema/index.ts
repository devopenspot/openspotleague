import {
  boolean,
  bigint,
  check,
  customType,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import type {
  GameMutationResponse,
  SpotTypeSnapshot,
} from "@/lib/schemas/game";
import type { LeagueMutationResponse } from "@/lib/schemas/league";
import type {
  EventLifecycleStatus,
  EventMembershipStatus,
  EventOrigin,
  EventPaymentStatus,
  EventRole,
  EventRunStatus,
  EventSignalType,
  EventVisibility,
  NotificationPayload,
  NotificationType,
} from "@/types/sport-events";

const geographyPoint = customType<{
  data: { lat: number; lon: number };
  driverData: string;
}>({
  dataType() {
    return "geography(Point,4326)";
  },
  toDriver(value) {
    return `SRID=4326;POINT(${value.lon} ${value.lat})`;
  },
  fromDriver(value) {
    // postgres-js returns a `geography(Point,4326)` column as hex-encoded
    // EWKB (Extended Well-Known Binary). Accept that as the primary
    // format, with a WKT/EWKT fallback for any other future driver.
    if (
      typeof value === "string" &&
      /^[0-9A-Fa-f]+$/.test(value) &&
      value.length >= 50
    ) {
      // EWKB Point with SRID = 25 bytes = 50 hex chars.
      // Layout: [0]=endian, [1..4]=type, [5..8]=SRID, [9..16]=X (lon), [17..24]=Y (lat)
      const buf = Buffer.from(value, "hex");
      const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
      const lon = view.getFloat64(9, true);
      const lat = view.getFloat64(17, true);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        return { lat, lon };
      }
    }
    // Fallback: WKT / EWKT ("POINT(<lon> <lat>)" or "SRID=4326;POINT(...)")
    const match =
      /(?:SRID=\d+;)?POINT\s*\(\s*([-\d.eE]+)\s+([-\d.eE]+)\s*\)/i.exec(value);
    if (match) {
      return { lat: Number(match[2]), lon: Number(match[1]) };
    }
    throw new Error(`Invalid geography point: ${value}`);
  },
});

export const authSchema = pgSchema("auth");

export const authUsers = authSchema.table("users", {
  id: uuid("id").primaryKey(),
  // These columns already exist in Supabase Auth. They are mapped here only
  // for the server-side administrator user directory; no app migration owns
  // the auth schema.
  email: text("email"),
  createdAt: timestamp("created_at", { withTimezone: true }),
});

export type GamePlayerIdSnapshot = readonly string[];
export type GameRotationOrder = readonly string[];
export type SpotTypesUsed = readonly string[];
export type RoundCountBySpotType = Readonly<Record<string, number>>;
// `spots.type` is no longer a single FK — a spot has zero or more types
// (plaza, bowl, rails, ...) via the `spot_type_assignments` join table. The
// `spot_types` dimension table is unchanged.
export const spots = pgTable(
  "spots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    city: text("city").notNull(),
    citySlug: text("city_slug").notNull(),
    address: text("address").notNull(),
    // Nullable since 0037: a spot may have no photo yet. The read path
    // normalizes NULL/'' to an empty string (`rowToSpot`);
    // `extractStoragePath` maps '' to null.
    imageUrl: text("image_url"),
    countryCode: text("country_code")
      .notNull()
      .references(() => countries.iso2, { onDelete: "restrict" }),
    // Public Instagram profile URL for the spot. Nullable so a spot
    // may have no social presence.
    instagram: text("instagram"),
    // Denormalized total of how many users have verified the spot.
    // Kept in sync by the `bump_verification_count` trigger on
    // `verified_spots`. NOT NULL with a DB-level CHECK so the
    // read path is a single column fetch — no per-row aggregate.
    verificationCount: integer("verification_count").notNull().default(0),
    visibility: text("visibility").notNull().default("public"),
    origin: text("origin").notNull().default("seed"),
    communitySubmissionCount: integer("community_submission_count").notNull().default(0),
    adminHidden: boolean("admin_hidden").notNull().default(false),
    // Denormalized display read-model (0034): type snapshots `{name, slug}` and
    // capitalized sport display names, written alongside the assignments.
    types: jsonb("types")
      .notNull()
      .default(sql`'[]'::jsonb`)
      .$type<readonly { name: string; slug: string }[]>(),
    sports: text("sports").array().notNull().default(sql`'{}'::text[]`),
    location: geographyPoint("location").notNull(),
    createdBy: uuid("created_by").references(() => authUsers.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => authUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("spots_slug_key").on(t.slug),
    index("spots_country_code_idx").on(t.countryCode),
    index("spots_city_slug_idx").on(t.citySlug),
    index("spots_location_gist_idx").using("gist", t.location),
    index("spots_visibility_idx").on(t.visibility),
    index("spots_origin_idx").on(t.origin),
    index("spots_admin_hidden_idx").on(t.adminHidden),
    index("spots_admin_hidden_visibility_idx").on(t.adminHidden, t.visibility),
    check("spots_city_check", sql`length(${t.city}) > 0`),
    check("spots_city_slug_check", sql`length(${t.citySlug}) > 0`),
    check("spots_name_check", sql`length(${t.name}) > 0`),
    check("spots_slug_check", sql`length(${t.slug}) > 0`),
    check("spots_verification_count_check", sql`${t.verificationCount} >= 0`),
    check("spots_visibility_check", sql`${t.visibility} in ('personal','public')`),
    check("spots_origin_check", sql`${t.origin} in ('seed','community','user_personal')`),
    check("spots_community_submission_count_check", sql`${t.communitySubmissionCount} >= 0`),
  ],
);

// Multi-image spot support (0034): one row per stored image, ordered by
// `sort_order`; `image_path`-flavored keys `spots/<spotId>/<imageId>[.webp]`.
export const spotImages = pgTable(
  "spot_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spotId: uuid("spot_id")
      .notNull()
      .references(() => spots.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("spot_images_spot_path_key").on(t.spotId, t.path),
    index("spot_images_spot_id_sort_order_idx").on(t.spotId, t.sortOrder),
    check("spot_images_path_check", sql`length(${t.path}) > 0`),
    check("spot_images_sort_order_check", sql`${t.sortOrder} >= 0`),
  ],
);

// Unified sport events: editorial ("seed") directory entries and user-created
// league events ("community") share this table, separated by `origin` /
// `visibility`. Competition state lives in child tables (memberships, invites,
// criteria, runs, scores, results) and the lifecycle is a stored `status`
// (the public directory still derives upcoming/live/completed from dates).
// `version` is the OCC counter every event mutation bumps — the league engine
// uses it for optimistic concurrency (`SELECT … FOR UPDATE` + expectedVersion).
// Specs: .agents/specs/league/*.spec.md.
export const sportEvents = pgTable(
  "sport_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    shortName: text("short_name"),
    description: text("description").notNull().default(""),
    origin: text("origin").$type<EventOrigin>().notNull().default("community"),
    visibility: text("visibility").$type<EventVisibility>().notNull().default("unlisted"),
    status: text("status").$type<EventLifecycleStatus>().notNull().default("draft"),
    timezone: text("timezone").notNull(),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }),
    registrationClosesAt: timestamp("registration_closes_at", { withTimezone: true }),
    schedulePublishedAt: timestamp("schedule_published_at", { withTimezone: true }),
    // Payment gate deadlines (community events only; null for editorial).
    // due = created_at + 3 days, deadline = created_at + 6 days. Between due
    // and deadline the event is read-only (payment-only); after the deadline
    // without a registered payment it is disabled definitively. See
    // .agents/specs/league/engine.spec.md.
    paymentDueAt: timestamp("payment_due_at", { withTimezone: true }),
    paymentDeadlineAt: timestamp("payment_deadline_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    resultsPublishedAt: timestamp("results_published_at", { withTimezone: true }),
    city: text("city").notNull(),
    citySlug: text("city_slug"),
    address: text("address"),
    countryCode: text("country_code")
      .notNull()
      .references(() => countries.iso2, { onDelete: "restrict" }),
    venue: text("venue"),
    location: geographyPoint("location"),
    spotId: uuid("spot_id").references(() => spots.id, { onDelete: "set null" }),
    spotNameSnapshot: text("spot_name_snapshot"),
    spotCitySnapshot: text("spot_city_snapshot"),
    categorySlug: text("category_slug")
      .notNull()
      .default("local-event")
      .references(() => eventCategories.slug, { onDelete: "restrict" }),
    planSlug: text("plan_slug")
      .notNull()
      .default("free")
      .references(() => eventPlans.slug, { onDelete: "restrict" }),
    featured: boolean("featured").notNull().default(false),
    imageUrl: text("image_url").notNull(),
    url: text("url"),
    instagram: text("instagram"),
    youtube: text("youtube"),
    version: integer("version").notNull().default(0),
    createdBy: uuid("created_by").references(() => authUsers.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => authUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("sport_events_slug_key").on(t.slug),
    index("sport_events_country_code_idx").on(t.countryCode),
    index("sport_events_category_slug_idx").on(t.categorySlug),
    index("sport_events_plan_slug_idx").on(t.planSlug),
    index("sport_events_start_at_idx").on(t.startAt),
    index("sport_events_start_at_id_idx").on(t.startAt, t.id),
    index("sport_events_country_start_at_idx").on(t.countryCode, t.startAt),
    index("sport_events_city_slug_idx").on(t.citySlug),
    index("sport_events_location_gist_idx").using("gist", t.location),
    index("sport_events_origin_idx").on(t.origin),
    index("sport_events_visibility_idx").on(t.visibility),
    index("sport_events_status_idx").on(t.status),
    index("sport_events_featured_idx").on(t.featured),
    index("sport_events_payment_deadline_idx").on(t.paymentDeadlineAt),
    index("sport_events_created_by_origin_created_idx").on(
      t.createdBy,
      t.origin,
      t.createdAt,
    ),
    // Trigram search support (0026): Drizzle has no gin_trgm_ops builder —
    // raw expression mirrors `USING gin (lower(name) gin_trgm_ops)`.
    index("sport_events_name_trgm_idx").using(
      "gin",
      sql`lower(${t.name}) gin_trgm_ops`,
    ),
    index("sport_events_city_trgm_idx").using(
      "gin",
      sql`lower(${t.city}) gin_trgm_ops`,
    ),
    check("sport_events_origin_check", sql`${t.origin} in ('seed','community')`),
    check("sport_events_visibility_check", sql`${t.visibility} in ('public','unlisted')`),
    check(
      "sport_events_status_check",
      sql`${t.status} in ('draft','registration_open','registration_closed','scheduled','live','completed','cancelled')`,
    ),
    check("sport_events_timezone_check", sql`length(${t.timezone}) > 0`),
    check("sport_events_city_check", sql`length(${t.city}) > 0`),
    check("sport_events_image_url_check", sql`length(${t.imageUrl}) > 0`),
    check("sport_events_name_check", sql`length(${t.name}) > 0`),
    check("sport_events_slug_check", sql`length(${t.slug}) > 0`),
    check("sport_events_version_check", sql`${t.version} >= 0`),
    check(
      "sport_events_end_at_after_start_at_check",
      sql`"end_at" is null or "end_at" >= "start_at"`,
    ),
  ],
);

export const tvVideos = pgTable(
  "tv_videos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    youtubeUrl: text("youtube_url").notNull(),
    disciplineSlug: text("discipline_slug")
      .notNull()
      .references(() => sportDisciplines.slug, { onDelete: "restrict" }),
    categories: text("categories").array().notNull().default(sql`'{}'::text[]`),
    postDate: timestamp("post_date", { withTimezone: true }).notNull(),
    published: boolean("published").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: uuid("created_by").references(() => authUsers.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => authUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("tv_videos_published_discipline_post_date_idx").on(
      t.published,
      t.disciplineSlug,
      t.postDate,
    ),
    index("tv_videos_categories_gin_idx").using("gin", t.categories),
    index("tv_videos_published_sort_idx").on(t.published, t.sortOrder, t.createdAt),
    index("tv_videos_discipline_idx").on(t.disciplineSlug),
    index("tv_videos_published_keyset_idx")
      .on(t.sortOrder.asc(), t.postDate.desc(), t.createdAt.desc(), t.id.desc())
      .where(sql`${t.published} = true`),
    index("tv_videos_published_discipline_keyset_idx")
      .on(t.disciplineSlug.asc(), t.sortOrder.asc(), t.postDate.desc(), t.createdAt.desc(), t.id.desc())
      .where(sql`${t.published} = true`),
    check("tv_videos_title_check", sql`length(${t.title}) > 0`),
    check("tv_videos_youtube_url_check", sql`length(${t.youtubeUrl}) > 0`),
    check(
      "tv_videos_categories_check",
      sql`cardinality(${t.categories}) >= 1 and cardinality(${t.categories}) <= 12 and array_position(${t.categories}, '') is null and array_position(${t.categories}, null) is null`,
    ),
    check("tv_videos_sort_order_check", sql`${t.sortOrder} >= 0`),
  ],
);

export const savedSpots = pgTable(
  "saved_spots",
  {
    // Every saved spot is owned by a real Supabase auth user. Removing
    // an auth user cascades to their saved spots.
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    spotId: uuid("spot_id")
      .notNull()
      .references(() => spots.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.spotId] }),
    index("saved_spots_user_created_idx").on(t.userId, t.createdAt),
    index("saved_spots_spot_idx").on(t.spotId),
  ],
);

// End-user verifications ("I confirm this spot is legit"). Structurally
// identical to `saved_spots` (composite PK, FKs to `auth.users` and
// `spots` with cascade) but semantically a public signal rather than
// a personal bookmark. The `bump_verification_count` trigger on this
// table keeps `spots.verification_count` in sync.
export const verifiedSpots = pgTable(
  "verified_spots",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    spotId: uuid("spot_id")
      .notNull()
      .references(() => spots.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.spotId] }),
    index("verified_spots_user_created_idx").on(t.userId, t.createdAt),
    index("verified_spots_spot_idx").on(t.spotId),
  ],
);

// Anonymous community submissions: tracks who submitted where for the
// 300m promotion rule. One row per `POST /api/spots` attempt; never exposed
// to clients. Count distinct user_id within ST_DWithin(300) decides promotion.
export const communitySpotSubmissions = pgTable(
  "community_spot_submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    canonicalSpotId: uuid("canonical_spot_id").references(() => spots.id, { onDelete: "set null" }),
    location: geographyPoint("location").notNull(),
    submissionHash: text("submission_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("community_submissions_user_hash_unique").on(t.userId, t.submissionHash),
    index("community_submissions_location_gist_idx").using("gist", t.location),
    index("community_submissions_hash_idx").on(t.submissionHash),
    index("community_submissions_canonical_idx").on(t.canonicalSpotId),
    check("community_submissions_hash_check", sql`length(${t.submissionHash}) > 0`),
  ],
);

// Weather verifications: each row is a rider confirming the live weather
// at a spot. Many per user (unlike verified_spots which is 1/user), but
// throttled to 1 per 30 min in the service layer. TTL 2 h via expiresAt;
// active set = expiresAt > now(). Displayed as most-voted icon with count.
export const spotWeatherVerifications = pgTable(
  "spot_weather_verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spotId: uuid("spot_id")
      .notNull()
      .references(() => spots.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    voteIcon: text("vote_icon").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    index("spot_weather_verifications_spot_expires_idx").on(t.spotId, t.expiresAt),
    index("spot_weather_verifications_spot_created_idx").on(t.spotId, t.createdAt),
    index("spot_weather_verifications_user_spot_created_idx").on(t.userId, t.spotId, t.createdAt),
    check(
      "spot_weather_verifications_vote_icon_check",
      sql`${t.voteIcon} in ('sunny','partly_cloudy_day','cloudy','rain','snow')`,
    ),
    check(
      "spot_weather_verifications_expires_after_created_check",
      sql`${t.expiresAt} > ${t.createdAt}`,
    ),
  ],
);

export const profiles = pgTable("profiles", {
  id: uuid("id")
    .primaryKey()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  email: text("email").notNull(),
  initials: text("initials").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  distanceUnit: text("distance_unit").notNull().default("mi"),
  temperatureUnit: text("temperature_unit").notNull().default("C"),
  preferredDisciplineSlug: text("preferred_discipline_slug"),
}, (t) => [
  index("profiles_preferred_discipline_idx").on(t.preferredDisciplineSlug),
  check(
    "profiles_preferred_discipline_slug_check",
    sql`${t.preferredDisciplineSlug} is null or ${t.preferredDisciplineSlug} in ('roller', 'skateboard', 'bmx', 'scooter', 'all')`,
  ),
  check("profiles_display_name_check", sql`length(${t.displayName}) > 0`),
  check(
    "profiles_email_check",
    sql`${t.email} ~ '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$'`,
  ),
  check(
    "profiles_distance_unit_check",
    sql`${t.distanceUnit} in ('mi', 'km')`,
  ),
  check(
    "profiles_temperature_unit_check",
    sql`${t.temperatureUnit} in ('C', 'F')`,
  ),
]);

export type WeatherIconSnapshot = "sunny" | "partly_cloudy_day" | "cloudy" | "rain" | "snow"

export const gameSessions = pgTable(
  "game_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
     shareCode: text("share_code").notNull(),
    mode: text("mode").notNull(),
    challengeRule: text("rule_mode").notNull().default("flexible"),
    gameFormat: text("game_format").notNull().default("tricks"),
    trainingVariant: text("training_variant").notNull().default("multiplayer"),
    lapCount: integer("lap_count"),
    ghostMode: text("ghost_mode").notNull().default("off"),
    disciplineSlug: text("discipline_slug").notNull(),
    challengeKey: text("challenge_key").notNull(),
    gameName: text("game_name").notNull(),
    eliminationWord: text("elimination_word").notNull(),
    wordLength: integer("word_length").notNull(),
    catalogId: uuid("catalog_id").notNull().references(() => challengeCatalogs.id, { onDelete: "restrict" }),
    spotId: uuid("spot_id").references(() => spots.id, { onDelete: "set null" }),
    // Moderation detach marker + display snapshots. When a spot is hard-deleted
    // for curation, surviving games keep these instead of their `spot_id`
    // (see `detachSpotDependents`). New rows default to `false`, so the
    // challenge/training CHECKs below stay strict for every other write path.
    spotRemoved: boolean("spot_removed").notNull().default(false),
    spotNameSnapshot: text("spot_name_snapshot"),
    spotCitySnapshot: text("spot_city_snapshot"),
    scheduledStartAt: timestamp("scheduled_start_at", { withTimezone: true }),
    timezone: text("timezone"),
     locationRadiusMeters: integer("location_radius_meters"),
    locationMaxAccuracyMeters: integer("location_max_accuracy_meters"),
    locationVerificationTtlSeconds: integer("location_verification_ttl_seconds"),
    weatherForecastIcon: text("weather_forecast_icon"),
    weatherForecastDescription: text("weather_forecast_description"),
    weatherForecastTemp: integer("weather_forecast_temp"),
    weatherObservedIcon: text("weather_observed_icon"),
    weatherConfirmed: boolean("weather_confirmed"),
    weatherReportedAt: timestamp("weather_reported_at", { withTimezone: true }),
    weatherForecastSnapshot: jsonb("weather_forecast_snapshot").$type<{ icon: WeatherIconSnapshot; description: string; temp: number | null; humidity: number | null; wind: number | null } | null>(),
     availableSpotTypes: jsonb("available_spot_types")
       .$type<readonly SpotTypeSnapshot[]>()
       .notNull(),
     initialSpotType: text("initial_spot_type").notNull(),
     nextSpotType: text("next_spot_type").notNull(),
      nextLevel: integer("next_level"),
      selectedCategories: jsonb("selected_categories").$type<readonly string[] | null>(),
      pendingCategories: jsonb("pending_categories").$type<readonly string[] | null>(),
      pendingProposerPlayerId: uuid("pending_proposer_player_id"),
      pendingVotes: jsonb("pending_votes").$type<readonly { playerId: string; vote: "pending" | "accepted" | "rejected" }[] | null>(),
      pendingProposalCreatedAt: timestamp("pending_proposal_created_at", { withTimezone: true }),
     status: text("status").notNull().default("lobby"),
     createdBy: uuid("created_by").references(() => authUsers.id, { onDelete: "set null" }),
    creatorIpHash: text("creator_ip_hash").notNull(),
    creatorDisplayName: text("creator_display_name").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
     winnerPlayerId: uuid("winner_player_id"),
     currentRoundId: uuid("current_round_id"),
     currentChallengerPlayerId: uuid("current_challenger_player_id"),
     rotationOrder: jsonb("rotation_order")
       .$type<GameRotationOrder>()
       .notNull(),
    rotationIndex: integer("rotation_index").notNull().default(0),
    version: integer("version").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
     unique("game_sessions_share_code_key").on(t.shareCode),
    index("game_sessions_created_by_idx").on(t.createdBy, t.createdAt),
    index("game_sessions_training_ip_status_idx").on(t.creatorIpHash, t.mode, t.status),
    index("game_sessions_spot_idx").on(t.spotId),
     index("game_sessions_mode_status_idx").on(t.mode, t.status),
     index("game_sessions_current_round_idx").on(t.currentRoundId),
     index("game_sessions_racing_leaderboard_idx").on(t.gameFormat, t.status, t.lapCount),
     foreignKey({
       columns: [t.id, t.winnerPlayerId],
       foreignColumns: [gamePlayers.gameId, gamePlayers.id],
       name: "game_sessions_winner_player_fk",
     }).onDelete("set null"),
     foreignKey({
       columns: [t.id, t.currentRoundId],
       foreignColumns: [gameRounds.gameId, gameRounds.id],
       name: "game_sessions_current_round_fk",
     }).onDelete("set null"),
     foreignKey({
       columns: [t.id, t.currentChallengerPlayerId],
       foreignColumns: [gamePlayers.gameId, gamePlayers.id],
       name: "game_sessions_current_challenger_player_fk",
     }).onDelete("set null"),
    check("game_sessions_status_check", sql`${t.status} in ('lobby', 'active', 'complete', 'cancelled')`),
    check("game_sessions_mode_check", sql`${t.mode} in ('challenge', 'training')`),
    check("game_sessions_rule_mode_check", sql`${t.challengeRule} in ('strict', 'flexible')`),
    check("game_sessions_game_format_check", sql`${t.gameFormat} in ('tricks', 'bmx_track_racing')`),
    check("game_sessions_training_variant_check", sql`${t.trainingVariant} in ('multiplayer', 'solo')`),
    check("game_sessions_solo_variant_check", sql`${t.trainingVariant} <> 'solo' or (${t.mode} = 'training' and ${t.gameFormat} = 'tricks')`),
    check("game_sessions_ghost_mode_check", sql`${t.ghostMode} in ('off', 'global_best')`),
    check("game_sessions_racing_settings_check", sql`${t.gameFormat} <> 'bmx_track_racing' or (${t.disciplineSlug} = 'bmx' and ${t.lapCount} between 1 and 20 and ${t.ghostMode} = 'global_best')`),
     check("game_sessions_discipline_slug_check", sql`${t.disciplineSlug} in ('roller', 'skateboard', 'bmx', 'scooter')`),
    check("game_sessions_challenge_key_check", sql`${t.challengeKey} in ('blade', 'skate', 'bike', 'scoot')`),
     check("game_sessions_elimination_word_check", sql`${t.eliminationWord} = upper(${t.eliminationWord})`),
     check("game_sessions_check", sql`${t.wordLength} = char_length(${t.eliminationWord})`),
    check("game_sessions_definition_consistency_check", sql`(
      (${t.disciplineSlug} = 'roller' and ${t.challengeKey} = 'blade' and ${t.gameName} = 'Play a Blade' and ${t.eliminationWord} = 'BLADE' and ${t.wordLength} = 5) or
      (${t.disciplineSlug} = 'skateboard' and ${t.challengeKey} = 'skate' and ${t.gameName} = 'Play a Skate' and ${t.eliminationWord} = 'SKATE' and ${t.wordLength} = 5) or
      (${t.disciplineSlug} = 'bmx' and ${t.challengeKey} = 'bike' and ${t.gameName} = 'Play a Bike' and ${t.eliminationWord} = 'BIKE' and ${t.wordLength} = 4) or
      (${t.disciplineSlug} = 'scooter' and ${t.challengeKey} = 'scoot' and ${t.gameName} = 'Play a Scoot' and ${t.eliminationWord} = 'SCOOT' and ${t.wordLength} = 5)
    )`),
    check("game_sessions_next_level_check", sql`${t.nextLevel} is null or ${t.nextLevel} between 1 and 5`),
    check("game_sessions_version_check", sql`${t.version} >= 0`),
    check("game_sessions_rotation_index_check", sql`${t.rotationIndex} >= 0`),
    check("game_sessions_snapshot_nonempty_check", sql`jsonb_typeof(${t.availableSpotTypes}) = 'array' and jsonb_array_length(${t.availableSpotTypes}) > 0`),
    check("game_sessions_available_spot_types_shape_check", sql`jsonb_is_spot_type_snapshot_array(${t.availableSpotTypes})`),
    check("game_sessions_rotation_order_shape_check", sql`jsonb_is_unique_uuid_array(${t.rotationOrder})`),
    check("game_sessions_initial_spot_type_snapshot_check", sql`${t.availableSpotTypes} @> jsonb_build_array(jsonb_build_object('slug', ${t.initialSpotType}))`),
    check("game_sessions_next_spot_type_snapshot_check", sql`${t.availableSpotTypes} @> jsonb_build_array(jsonb_build_object('slug', ${t.nextSpotType}))`),
    check("game_sessions_challenge_requires_spot_check", sql`(${t.mode} <> 'challenge' or ((${t.spotId} is not null and ${t.scheduledStartAt} is not null and ${t.timezone} is not null and ${t.locationRadiusMeters} is not null and ${t.locationMaxAccuracyMeters} is not null and ${t.locationVerificationTtlSeconds} is not null and ${t.createdBy} is not null) or (${t.spotId} is null and ${t.spotRemoved})))`),
    check("game_sessions_training_forbids_spot_check", sql`${t.mode} <> 'training' or (
      (${t.spotId} is null and ${t.scheduledStartAt} is null and ${t.timezone} is null and ${t.locationRadiusMeters} is null and ${t.locationMaxAccuracyMeters} is null and ${t.locationVerificationTtlSeconds} is null)
      or (${t.spotId} is not null and ${t.scheduledStartAt} is null and ${t.timezone} is null and ${t.locationRadiusMeters} is not null and ${t.locationMaxAccuracyMeters} is not null and ${t.locationVerificationTtlSeconds} is not null)
    )`),
    check("game_sessions_training_weather_check", sql`(${t.weatherConfirmed} is null and ${t.weatherForecastIcon} is null and ${t.weatherObservedIcon} is null and ${t.weatherReportedAt} is null) or (${t.weatherForecastIcon} is not null and ${t.weatherConfirmed} is not null and ${t.weatherConfirmed} in (true, false) and (${t.weatherConfirmed} = true or ${t.weatherObservedIcon} is not null) and ((${t.spotId} is not null) or (${t.spotId} is null and ${t.spotRemoved})))`),
    check("game_sessions_weather_icon_check", sql`${t.weatherForecastIcon} is null or ${t.weatherForecastIcon} in ('sunny','partly_cloudy_day','cloudy','rain','snow')`),
    check("game_sessions_weather_observed_icon_check", sql`${t.weatherObservedIcon} is null or ${t.weatherObservedIcon} in ('sunny','partly_cloudy_day','cloudy','rain','snow')`),
     check("game_sessions_location_radius_meters_check", sql`${t.locationRadiusMeters} is null or ${t.locationRadiusMeters} > 0`),
     check("game_sessions_location_max_accuracy_meters_check", sql`${t.locationMaxAccuracyMeters} is null or ${t.locationMaxAccuracyMeters} > 0`),
     check("game_sessions_location_verification_ttl_seconds_check", sql`${t.locationVerificationTtlSeconds} is null or ${t.locationVerificationTtlSeconds} > 0`),
  ],
);

export const spotWeatherReports = pgTable(
  "spot_weather_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spotId: uuid("spot_id").notNull().references(() => spots.id, { onDelete: "restrict" }),
    gameId: uuid("game_id").notNull().references(() => gameSessions.id, { onDelete: "cascade" }),
    reporterId: uuid("reporter_id").references(() => authUsers.id, { onDelete: "set null" }),
    forecastIcon: text("forecast_icon").notNull(),
    observedIcon: text("observed_icon").notNull(),
    confirmed: boolean("confirmed").notNull(),
    forecastSnapshot: jsonb("forecast_snapshot").$type<{ icon: WeatherIconSnapshot; description: string; temp: number | null; humidity: number | null; wind: number | null } | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("spot_weather_reports_game_unique").on(t.gameId),
    index("spot_weather_reports_spot_created_idx").on(t.spotId, t.createdAt),
    index("spot_weather_reports_game_idx").on(t.gameId),
    check("spot_weather_reports_forecast_icon_check", sql`${t.forecastIcon} in ('sunny','partly_cloudy_day','cloudy','rain','snow')`),
    check("spot_weather_reports_observed_icon_check", sql`${t.observedIcon} in ('sunny','partly_cloudy_day','cloudy','rain','snow')`),
  ],
)

export const gamePlayers = pgTable(
  "game_players",
  {
    id: uuid("id").primaryKey().defaultRandom(),
     gameId: uuid("game_id").notNull().references((): AnyPgColumn => gameSessions.id, { onDelete: "cascade" }),
     userId: uuid("user_id").references(() => authUsers.id, { onDelete: "cascade" }),
    guestToken: text("guest_token"),
    displayName: text("display_name").notNull(),
    seatOrder: integer("seat_order").notNull(),
    letters: text("letters").notNull().default(""),
    failedAttempts: integer("failed_attempts").notNull().default(0),
    status: text("status").notNull().default("active"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("game_players_game_user_unique").on(t.gameId, t.userId).where(sql`${t.userId} is not null`),
     unique("game_players_game_seat_unique").on(t.gameId, t.seatOrder),
     unique("game_players_game_id_id_unique").on(t.gameId, t.id),
    uniqueIndex("game_players_game_guest_unique").on(t.gameId, t.guestToken).where(sql`${t.guestToken} is not null`),
    index("game_players_guest_token_idx").on(t.guestToken).where(sql`${t.guestToken} is not null`),
    index("game_players_game_status_idx").on(t.gameId, t.status),
    index("game_players_user_id_idx").on(t.userId).where(sql`${t.userId} is not null`),
    check("game_players_status_check", sql`${t.status} in ('active', 'eliminated', 'left')`),
    check("game_players_display_name_check", sql`char_length(${t.displayName}) between 1 and 30`),
    check("game_players_seat_order_check", sql`${t.seatOrder} >= 0`),
    check("game_players_identity_check", sql`(${t.userId} is null) <> (${t.guestToken} is null)`),
    check("game_players_failed_attempts_check", sql`${t.failedAttempts} >= 0`),
  ],
);

export const gameRounds = pgTable(
  "game_rounds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
     gameId: uuid("game_id").notNull().references((): AnyPgColumn => gameSessions.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
     challengerPlayerId: uuid("challenger_player_id"),
    trickId: text("trick_id"),
    trickNameSnapshot: text("trick_name_snapshot"),
    trickDescriptionSnapshot: text("trick_description_snapshot"),
    trickLevel: integer("trick_level"),
     levelSelectedByPlayerId: uuid("level_selected_by_player_id"),
    spotType: text("spot_type").notNull(),
    spotTypeChanged: boolean("spot_type_changed").notNull().default(false),
     spotTypeChangedByPlayerId: uuid("spot_type_changed_by_player_id"),
     spotTypeSnapshot: jsonb("spot_type_snapshot")
       .$type<readonly SpotTypeSnapshot[]>()
       .notNull(),
     trickCompatibilitySnapshot: jsonb("trick_compatibility_snapshot")
       .$type<readonly string[] | null>(),
     eligiblePlayerIds: jsonb("eligible_player_ids")
       .$type<GamePlayerIdSnapshot>()
       .notNull()
       .default(sql`'[]'::jsonb`),
     catalogTrickId: uuid("catalog_trick_id").references(() => challengeCatalogTricks.id, { onDelete: "set null" }),
    trickSourceId: text("trick_source_id"),
    trickDisciplineSnapshot: text("trick_discipline_snapshot"),
    blockedReason: text("blocked_reason"),
    challengerResult: text("challenger_result").notNull().default("pending"),
    challengeOutcome: text("challenge_outcome"),
    leadRetained: boolean("lead_retained").notNull().default(false),
    challengerAttemptedAt: timestamp("challenger_attempted_at", { withTimezone: true }),
    status: text("status").notNull().default("verifying_location"),
     requiredResponsePlayerIds: jsonb("required_response_player_ids")
       .$type<GamePlayerIdSnapshot>()
       .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [
     unique("game_rounds_game_sequence_unique").on(t.gameId, t.sequence),
     unique("game_rounds_game_id_id_unique").on(t.gameId, t.id),
    index("game_rounds_game_status_idx").on(t.gameId, t.status),
    index("game_rounds_catalog_trick_idx").on(t.catalogTrickId),
     foreignKey({
       columns: [t.gameId, t.challengerPlayerId],
       foreignColumns: [gamePlayers.gameId, gamePlayers.id],
       name: "game_rounds_challenger_player_fk",
     }).onDelete("set null"),
     foreignKey({
       columns: [t.gameId, t.levelSelectedByPlayerId],
       foreignColumns: [gamePlayers.gameId, gamePlayers.id],
       name: "game_rounds_level_selected_fk",
     }).onDelete("set null"),
     foreignKey({
       columns: [t.gameId, t.spotTypeChangedByPlayerId],
       foreignColumns: [gamePlayers.gameId, gamePlayers.id],
       name: "game_rounds_spot_type_changed_fk",
     }).onDelete("set null"),
    check("game_rounds_level_check", sql`${t.trickLevel} is null or ${t.trickLevel} between 1 and 5`),
    check("game_rounds_sequence_check", sql`${t.sequence} > 0`),
    check("game_rounds_challenge_outcome_check", sql`${t.challengeOutcome} is null or ${t.challengeOutcome} in ('established', 'failed_to_establish', 'resolved')`),
    check("game_rounds_challenger_result_check", sql`${t.challengerResult} in ('pending', 'landed', 'failed')`),
    check("game_rounds_status_check", sql`${t.status} in ('verifying_location', 'selecting_spot_type', 'selecting_level', 'no_compatible_trick', 'challenge_open', 'collecting_results', 'resolved', 'paused', 'cancelled')`),
    check("game_rounds_trick_discipline_check", sql`${t.trickDisciplineSnapshot} is null or ${t.trickDisciplineSnapshot} in ('roller', 'skateboard', 'bmx', 'scooter')`),
    check("game_rounds_spot_type_snapshot_shape_check", sql`jsonb_is_spot_type_snapshot_array(${t.spotTypeSnapshot})`),
    check("game_rounds_trick_compatibility_shape_check", sql`${t.trickCompatibilitySnapshot} is null or jsonb_is_unique_nonempty_text_array(${t.trickCompatibilitySnapshot})`),
    check("game_rounds_eligible_player_ids_shape_check", sql`jsonb_is_unique_uuid_array(${t.eligiblePlayerIds})`),
    check("game_rounds_required_response_player_ids_shape_check", sql`jsonb_is_unique_uuid_array(${t.requiredResponsePlayerIds})`),
  ],
);

export const gameAttempts = pgTable(
  "game_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
     roundId: uuid("round_id").notNull().references((): AnyPgColumn => gameRounds.id, { onDelete: "cascade" }),
     playerId: uuid("player_id").notNull().references((): AnyPgColumn => gamePlayers.id),
    result: text("result").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("game_attempts_round_player_unique").on(t.roundId, t.playerId),
    index("game_attempts_round_submitted_idx").on(t.roundId, t.submittedAt),
    check("game_attempts_result_check", sql`${t.result} in ('landed', 'failed')`),
  ],
);

export const gameActionRequests = pgTable(
  "game_action_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
     gameId: uuid("game_id").notNull().references((): AnyPgColumn => gameSessions.id, { onDelete: "cascade" }),
     userId: uuid("user_id").references(() => authUsers.id, { onDelete: "cascade" }),
    guestToken: text("guest_token"),
    action: text("action").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    resultingVersion: integer("resulting_version").notNull(),
     responseMetadata: jsonb("response_metadata")
       .$type<GameMutationResponse>()
       .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("game_action_requests_scope_unique").on(t.gameId, t.userId, t.action, t.idempotencyKey).where(sql`${t.userId} is not null`),
    uniqueIndex("game_action_requests_guest_scope_unique").on(t.gameId, t.guestToken, t.action, t.idempotencyKey).where(sql`${t.guestToken} is not null`),
    index("game_action_requests_created_idx").on(t.createdAt),
    index("game_action_requests_user_action_key_idx").on(t.userId, t.action, t.idempotencyKey),
    index("game_action_requests_game_action_created_idx").on(t.gameId, t.action, t.createdAt),
    check("game_action_requests_identity_check", sql`(${t.userId} is null) <> (${t.guestToken} is null)`),
  ],
);

export const gameLocationVerifications = pgTable(
  "game_location_verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
     gameId: uuid("game_id").notNull().references((): AnyPgColumn => gameSessions.id, { onDelete: "cascade" }),
     roundId: uuid("round_id").notNull().references((): AnyPgColumn => gameRounds.id, { onDelete: "cascade" }),
     playerId: uuid("player_id").notNull(),
    spotId: uuid("spot_id").notNull().references(() => spots.id, { onDelete: "restrict" }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    distanceMeters: integer("distance_meters"),
    accuracyMeters: integer("accuracy_meters"),
    status: text("status").notNull().default("pending"),
    rejectionReason: text("rejection_reason"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (t) => [
     unique("game_location_verifications_round_player_unique").on(t.roundId, t.playerId),
    index("game_location_verifications_game_round_idx").on(t.gameId, t.roundId),
     index("game_location_verifications_player_verified_idx").on(t.playerId, t.verifiedAt),
     index("game_location_verifications_spot_idx").on(t.spotId),
     foreignKey({
       columns: [t.gameId, t.playerId],
       foreignColumns: [gamePlayers.gameId, gamePlayers.id],
       name: "game_location_verifications_player_game_fk",
     }).onDelete("cascade"),
    check("game_location_verifications_status_check", sql`${t.status} in ('pending', 'verified', 'rejected', 'expired', 'unavailable')`),
    check("game_location_verifications_rejection_reason_check", sql`${t.rejectionReason} is null or ${t.rejectionReason} in ('too_far', 'low_accuracy', 'denied', 'unavailable')`),
  ],
);

export const gameRaceLaps = pgTable(
  "game_race_laps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .notNull()
       .references((): AnyPgColumn => gameSessions.id, { onDelete: "cascade" }),
    playerId: uuid("player_id").notNull(),
    lapNumber: integer("lap_number").notNull(),
    milliseconds: integer("milliseconds").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("game_race_laps_game_player_lap_unique").on(
      t.gameId,
      t.playerId,
      t.lapNumber,
    ),
    index("game_race_laps_game_lap_idx").on(t.gameId, t.lapNumber),
    index("game_race_laps_game_player_lap_time_idx").on(t.gameId, t.playerId, t.lapNumber, t.milliseconds),
    index("game_race_laps_player_time_idx").on(t.playerId, t.milliseconds),
    foreignKey({
      columns: [t.gameId, t.playerId],
      foreignColumns: [gamePlayers.gameId, gamePlayers.id],
      name: "game_race_laps_player_game_fk",
    }).onDelete("cascade"),
    check("game_race_laps_lap_number_check", sql`${t.lapNumber} between 1 and 20`),
    check("game_race_laps_milliseconds_check", sql`${t.milliseconds} > 0`),
  ],
);

export const gameRealtimeSignals = pgTable(
  "game_realtime_signals",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    gameId: uuid("game_id")
      .notNull()
       .references((): AnyPgColumn => gameSessions.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    signalType: text("signal_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("game_realtime_signals_game_version_unique").on(
      t.gameId,
      t.version,
    ),
    index("game_realtime_signals_game_created_idx").on(t.gameId, t.createdAt),
    check("game_realtime_signals_version_check", sql`${t.version} >= 0`),
    check(
      "game_realtime_signals_type_check",
      sql`${t.signalType} in ('game_state_changed', 'game_completed', 'game_cancelled')`,
    ),
  ],
);

export const spotChallengeRecords = pgTable(
  "spot_challenge_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
     gameId: uuid("game_id").notNull().references((): AnyPgColumn => gameSessions.id, { onDelete: "cascade" }),
    spotId: uuid("spot_id").references(() => spots.id, { onDelete: "set null" }),
    // Display snapshots kept when the spot is hard-deleted for moderation
    // (see `detachSpotDependents`). Audit trail only for now — no reader
    // yet, since record history is listed from the spot page while it
    // exists.
    spotNameSnapshot: text("spot_name_snapshot"),
    spotSlugSnapshot: text("spot_slug_snapshot"),
    disciplineSlug: text("discipline_slug").notNull(),
    gameName: text("game_name").notNull(),
    eliminationWord: text("elimination_word").notNull(),
    scheduledStartAt: timestamp("scheduled_start_at", { withTimezone: true }).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull(),
    participantCount: integer("participant_count").notNull(),
    verifiedParticipantCount: integer("verified_participant_count").notNull(),
     spotTypesUsed: jsonb("spot_types_used")
       .$type<SpotTypesUsed>()
       .notNull(),
     roundCountBySpotType: jsonb("round_count_by_spot_type")
       .$type<RoundCountBySpotType>()
       .notNull(),
    initialSpotType: text("initial_spot_type").notNull(),
    finalSpotType: text("final_spot_type").notNull(),
     winnerPlayerId: uuid("winner_player_id").notNull(),
    status: text("status").notNull(),
  },
  (t) => [
    unique("spot_challenge_records_game_unique").on(t.gameId),
    index("spot_challenge_records_spot_completed_idx").on(t.spotId, t.completedAt),
    foreignKey({
      columns: [t.gameId, t.winnerPlayerId],
      foreignColumns: [gamePlayers.gameId, gamePlayers.id],
      name: "spot_challenge_records_winner_player_fk",
    }).onDelete("restrict"),
    check("spot_challenge_records_status_check", sql`${t.status} = 'completed'`),
    check("spot_challenge_records_participant_count_check", sql`${t.participantCount} >= 2`),
    check("spot_challenge_records_verified_participant_count_check", sql`${t.verifiedParticipantCount} >= 2`),
    check("spot_challenge_records_verified_le_participant_check", sql`${t.verifiedParticipantCount} <= ${t.participantCount}`),
    check("spot_challenge_records_timestamps_check", sql`${t.startedAt} <= ${t.completedAt}`),
  ],
);

export const riderStats = pgTable("rider_stats", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  totalPoints: integer("total_points").notNull().default(0),
  gamesPlayed: integer("games_played").notNull().default(0),
  gamesWon: integer("games_won").notNull().default(0),
  tricksLanded: integer("tricks_landed").notNull().default(0),
  tricksFailed: integer("tricks_failed").notNull().default(0),
  eventsAttended: integer("events_attended").notNull().default(0),
  eventsWon: integer("events_won").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check("rider_stats_total_points_check", sql`${t.totalPoints} >= 0`),
  check("rider_stats_games_played_check", sql`${t.gamesPlayed} >= 0`),
  check("rider_stats_games_won_check", sql`${t.gamesWon} >= 0`),
  check("rider_stats_tricks_landed_check", sql`${t.tricksLanded} >= 0`),
  check("rider_stats_tricks_failed_check", sql`${t.tricksFailed} >= 0`),
  check("rider_stats_events_attended_check", sql`${t.eventsAttended} >= 0`),
  check("rider_stats_events_won_check", sql`${t.eventsWon} >= 0`),
]);

export const riderScoreEvents = pgTable(
  "rider_score_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
     userId: uuid("user_id")
       .notNull()
       .references(() => authUsers.id, { onDelete: "cascade" }),
     gameId: uuid("game_id").notNull().references((): AnyPgColumn => gameSessions.id, { onDelete: "cascade" }),
     roundId: uuid("round_id").references((): AnyPgColumn => gameRounds.id, { onDelete: "set null" }),
    eventType: text("event_type").notNull(),
    points: integer("points").notNull(),
    trickLevel: integer("trick_level"),
    eventKey: text("event_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
     unique("rider_score_events_event_key_key").on(t.eventKey),
    index("rider_score_events_game_round_idx").on(t.gameId, t.roundId),
    index("rider_score_events_user_created_idx").on(t.userId, t.createdAt),
     foreignKey({
       columns: [t.gameId, t.roundId],
       foreignColumns: [gameRounds.gameId, gameRounds.id],
       name: "rider_score_events_round_game_fk",
     }).onDelete("set null"),
    check("rider_score_events_level_check", sql`${t.trickLevel} is null or ${t.trickLevel} between 1 and 5`),
    check("rider_score_events_points_check", sql`${t.points} >= 0`),
    check("rider_score_events_event_type_check", sql`${t.eventType} in ('challenger_landed', 'response_landed', 'winner_bonus')`),
  ],
);

export const regions = pgTable(
  "regions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    imageUrl: text("image_url"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("regions_sort_order_idx").on(t.sortOrder),
    unique("regions_slug_key").on(t.slug),
    check("regions_name_check", sql`length(${t.name}) > 0`),
    check("regions_slug_check", sql`length(${t.slug}) > 0`),
    check("regions_sort_order_check", sql`${t.sortOrder} >= 0`),
  ],
);

export const countries = pgTable(
  "countries",
  {
    iso2: text("iso2").primaryKey(),
    name: text("name").notNull(),
    iso3: text("iso3"),
    regionId: uuid("region_id")
      .notNull()
      .references(() => regions.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("countries_region_idx").on(t.regionId),
    unique("countries_name_key").on(t.name),
    check("countries_iso2_check", sql`${t.iso2} ~ '^[A-Z]{2}$'`),
    check(
      "countries_iso3_check",
      sql`${t.iso3} is null or ${t.iso3} ~ '^[A-Z]{3}$'`,
    ),
    check("countries_name_check", sql`length(${t.name}) > 0`),
  ],
);

export const cities = pgTable(
  "cities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    countryCode: text("country_code")
      .notNull()
      .references(() => countries.iso2, { onDelete: "restrict" }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("cities_country_code_slug_key").on(t.countryCode, t.slug),
    index("cities_country_code_sort_order_idx").on(t.countryCode, t.sortOrder),
    index("cities_slug_idx").on(t.slug),
    check("cities_name_check", sql`length(${t.name}) > 0`),
    check("cities_slug_check", sql`length(${t.slug}) > 0`),
    check("cities_sort_order_check", sql`${t.sortOrder} >= 0`),
  ],
);

export const spotTypes = pgTable(
  "spot_types",
  {
    slug: text("slug").primaryKey(),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    index("spot_types_sort_order_idx").on(t.sortOrder),
    check("spot_types_name_check", sql`length(${t.name}) > 0`),
    check("spot_types_slug_check", sql`length(${t.slug}) > 0`),
    check("spot_types_sort_order_check", sql`${t.sortOrder} >= 0`),
  ],
);

export const sportDisciplines = pgTable(
  "sport_disciplines",
  {
    slug: text("slug").primaryKey(),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    index("sport_disciplines_sort_order_idx").on(t.sortOrder),
    check("sport_disciplines_name_check", sql`length(${t.name}) > 0`),
    check("sport_disciplines_slug_check", sql`length(${t.slug}) > 0`),
    check(
      "sport_disciplines_sort_order_check",
      sql`${t.sortOrder} >= 0`,
    ),
  ],
);

export const trickDefinitions = pgTable(
  "trick_definitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    disciplineSlug: text("discipline_slug")
      .notNull()
      .references(() => sportDisciplines.slug, { onDelete: "restrict" }),
    sourceId: text("source_id").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    level: integer("level").notNull(),
    categories: jsonb("categories").notNull().default(sql`'[]'::jsonb`).$type<readonly string[]>(),
    updatedBy: uuid("updated_by").references(() => authUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("trick_definitions_discipline_source_unique").on(
      t.disciplineSlug,
      t.sourceId,
    ),
    index("trick_definitions_discipline_level_idx").on(
      t.disciplineSlug,
      t.level,
    ),
    check("trick_definitions_source_id_check", sql`char_length(${t.sourceId}) > 0`),
    check("trick_definitions_name_check", sql`char_length(${t.name}) > 0`),
    check(
      "trick_definitions_description_check",
      sql`char_length(${t.description}) > 0`,
    ),
    check("trick_definitions_level_check", sql`${t.level} between 1 and 5`),
    check("trick_definitions_categories_check", sql`jsonb_typeof(${t.categories}) = 'array' and jsonb_array_length(${t.categories}) <= 12`),
  ],
);

export const trickDefinitionSpotTypes = pgTable(
  "trick_definition_spot_types",
  {
    trickId: uuid("trick_id")
      .notNull()
      .references(() => trickDefinitions.id, { onDelete: "cascade" }),
    spotTypeSlug: text("spot_type_slug")
      .notNull()
      .references(() => spotTypes.slug, { onDelete: "restrict" }),
  },
  (t) => [
    primaryKey({ columns: [t.trickId, t.spotTypeSlug] }),
    index("trick_definition_spot_types_slug_idx").on(t.spotTypeSlug),
  ],
);

export const trickCatalogStates = pgTable(
  "trick_catalog_states",
  {
    disciplineSlug: text("discipline_slug")
      .primaryKey()
      .references(() => sportDisciplines.slug, { onDelete: "restrict" }),
    version: integer("version").notNull().default(0),
    updatedBy: uuid("updated_by").references(() => authUsers.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
  },
  (t) => [check("trick_catalog_states_version_check", sql`${t.version} >= 0`)],
);

export const challengeCatalogs = pgTable(
  "challenge_catalogs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    disciplineSlug: text("discipline_slug").notNull().references(() => sportDisciplines.slug, { onDelete: "restrict" }),
    challengeKey: text("challenge_key").notNull(),
    gameName: text("game_name").notNull(),
    eliminationWord: text("elimination_word").notNull(),
    wordLength: integer("word_length").notNull(),
    sourcePath: text("source_path").notNull(),
    sourceSha256: text("source_sha256").notNull(),
    trickCount: integer("trick_count").notNull(),
    levelOneCount: integer("level_one_count").notNull(),
    levelTwoCount: integer("level_two_count").notNull(),
    levelThreeCount: integer("level_three_count").notNull(),
    levelFourCount: integer("level_four_count").notNull().default(0),
    levelFiveCount: integer("level_five_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("challenge_catalogs_discipline_sha_unique").on(t.disciplineSlug, t.sourceSha256),
    index("challenge_catalogs_discipline_idx").on(t.disciplineSlug),
    check("challenge_catalogs_challenge_key_lower_check", sql`${t.challengeKey} = lower(${t.challengeKey})`),
    check("challenge_catalogs_elimination_word_upper_check", sql`${t.eliminationWord} = upper(${t.eliminationWord})`),
    check("challenge_catalogs_word_length_check", sql`${t.wordLength} = char_length(${t.eliminationWord})`),
    check("challenge_catalogs_discipline_slug_check", sql`${t.disciplineSlug} in ('roller', 'skateboard', 'bmx', 'scooter')`),
    check("challenge_catalogs_challenge_key_check", sql`${t.challengeKey} in ('blade', 'skate', 'bike', 'scoot')`),
    check("challenge_catalogs_definition_consistency_check", sql`(
      (${t.disciplineSlug} = 'roller' and ${t.challengeKey} = 'blade' and ${t.gameName} = 'Play a Blade' and ${t.eliminationWord} = 'BLADE' and ${t.wordLength} = 5) or
      (${t.disciplineSlug} = 'skateboard' and ${t.challengeKey} = 'skate' and ${t.gameName} = 'Play a Skate' and ${t.eliminationWord} = 'SKATE' and ${t.wordLength} = 5) or
      (${t.disciplineSlug} = 'bmx' and ${t.challengeKey} = 'bike' and ${t.gameName} = 'Play a Bike' and ${t.eliminationWord} = 'BIKE' and ${t.wordLength} = 4) or
      (${t.disciplineSlug} = 'scooter' and ${t.challengeKey} = 'scoot' and ${t.gameName} = 'Play a Scoot' and ${t.eliminationWord} = 'SCOOT' and ${t.wordLength} = 5)
    )`),
    check("challenge_catalogs_counts_check", sql`${t.trickCount} >= 1 and ${t.levelOneCount} + ${t.levelTwoCount} + ${t.levelThreeCount} + ${t.levelFourCount} + ${t.levelFiveCount} = ${t.trickCount}`),
  ],
);

export const challengeCatalogTricks = pgTable(
  "challenge_catalog_tricks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    catalogId: uuid("catalog_id").notNull().references(() => challengeCatalogs.id, { onDelete: "cascade" }),
    sourceId: text("source_id").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    level: integer("level").notNull(),
    categories: jsonb("categories").notNull().default(sql`'[]'::jsonb`).$type<readonly string[]>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("challenge_catalog_tricks_catalog_source_unique").on(t.catalogId, t.sourceId),
    index("challenge_catalog_tricks_catalog_level_idx").on(t.catalogId, t.level),
    check("challenge_catalog_tricks_source_id_check", sql`char_length(${t.sourceId}) > 0`),
    check("challenge_catalog_tricks_name_check", sql`char_length(${t.name}) > 0`),
    check("challenge_catalog_tricks_description_check", sql`char_length(${t.description}) > 0`),
    check("challenge_catalog_tricks_level_check", sql`${t.level} between 1 and 5`),
    check("challenge_catalog_tricks_categories_check", sql`jsonb_typeof(${t.categories}) = 'array' and jsonb_array_length(${t.categories}) <= 12`),
  ],
);

export const challengeTrickSpotTypes = pgTable(
  "challenge_trick_spot_types",
  {
    trickId: uuid("trick_id").notNull().references(() => challengeCatalogTricks.id, { onDelete: "cascade" }),
    spotTypeSlug: text("spot_type_slug").notNull().references(() => spotTypes.slug, { onDelete: "restrict" }),
  },
  (t) => [
    primaryKey({ columns: [t.trickId, t.spotTypeSlug] }),
    index("challenge_trick_spot_types_slug_idx").on(t.spotTypeSlug),
  ],
);

export const roles = pgTable(
  "roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("roles_slug_check", sql`${t.slug} = lower(${t.slug}) and length(${t.slug}) > 0`),
    check("roles_name_check", sql`length(${t.name}) > 0`),
  ],
);

export const permissions = pgTable(
  "permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "permissions_slug_check",
      sql`${t.slug} = lower(${t.slug}) and length(${t.slug}) > 0`,
    ),
    check("permissions_name_check", sql`length(${t.name}) > 0`),
  ],
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.roleId, t.permissionId] }),
    index("role_permissions_permission_idx").on(t.permissionId),
  ],
);

export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    grantedBy: uuid("granted_by").references(() => authUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.roleId] }),
    index("user_roles_role_idx").on(t.roleId),
  ],
);

export const curatorCountryScopes = pgTable(
  "curator_country_scopes",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    countryCode: text("country_code")
      .notNull()
      .references(() => countries.iso2, { onDelete: "restrict" }),
    grantedBy: uuid("granted_by").references(() => authUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.countryCode] }),
    index("curator_country_scopes_country_idx").on(t.countryCode),
    check("curator_country_scopes_code_check", sql`${t.countryCode} ~ '^[A-Z]{2}$'`),
  ],
)

export const curatorDisciplineScopes = pgTable(
  "curator_discipline_scopes",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    disciplineSlug: text("discipline_slug")
      .notNull()
      .references(() => sportDisciplines.slug, { onDelete: "restrict" }),
    grantedBy: uuid("granted_by").references(() => authUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.disciplineSlug] }),
    index("curator_discipline_scopes_discipline_idx").on(t.disciplineSlug),
    check("curator_discipline_scopes_slug_check", sql`length(${t.disciplineSlug}) > 0`),
  ],
)

export const adminAuditLog = pgTable(
  "admin_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => authUsers.id),
    targetUserId: uuid("target_user_id")
      .notNull()
      .references(() => authUsers.id),
    action: text("action").notNull(),
    before: jsonb("before").notNull(),
    after: jsonb("after").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("admin_audit_log_target_idx").on(t.targetUserId),
    index("admin_audit_log_actor_idx").on(t.actorId),
    check("admin_audit_log_action_check", sql`${t.action} in ('replace_roles','replace_country_scopes','replace_discipline_scopes')`),
  ],
)

export const contentAuditLog = pgTable(
  "content_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => authUsers.id, { onDelete: "set null" }),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    disciplineSlug: text("discipline_slug").references(() => sportDisciplines.slug, { onDelete: "restrict" }),
    action: text("action").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    metadata: jsonb("metadata")
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("content_audit_log_entity_idx").on(t.entityType, t.entityId, t.createdAt),
    index("content_audit_log_actor_idx").on(t.actorId, t.createdAt),
    index("content_audit_log_discipline_idx").on(t.disciplineSlug, t.createdAt),
    check(
      "content_audit_log_entity_type_check",
      sql`${t.entityType} in ('spot', 'event', 'trick', 'tv_video')`,
    ),
    check(
      "content_audit_log_action_check",
      sql`${t.action} in ('create', 'update', 'delete')`,
    ),
    check(
      "content_audit_log_before_after_check",
      sql`(
        (${t.action} = 'create' and ${t.before} is null and ${t.after} is not null) or
        (${t.action} = 'update' and ${t.before} is not null and ${t.after} is not null) or
        (${t.action} = 'delete' and ${t.before} is not null and ${t.after} is null)
      )`,
    ),
  ],
);


export const eventCategories = pgTable(
  "event_categories",
  {
    slug: text("slug").primaryKey(),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    index("event_categories_sort_order_idx").on(t.sortOrder),
    check("event_categories_name_check", sql`length(${t.name}) > 0`),
    check("event_categories_sort_order_check", sql`${t.sortOrder} >= 0`),
  ],
);

// ---------- League billing / quotas (0026) ----------

export const eventPlans = pgTable(
  "event_plans",
  {
    slug: text("slug").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    priceCents: integer("price_cents").notNull(),
    currency: text("currency").notNull().default("USD"),
    maxRiders: integer("max_riders").notNull(),
    maxJudges: integer("max_judges").notNull(),
    maxOrganizers: integer("max_organizers").notNull(),
    monthlyEventLimit: integer("monthly_event_limit").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: uuid("created_by").references(() => authUsers.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => authUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("event_plans_default_unique").on(t.isDefault).where(sql`${t.isDefault} and ${t.active}`),
    check("event_plans_price_check", sql`${t.priceCents} >= 0`),
    check("event_plans_currency_check", sql`${t.currency} ~ '^[A-Z]{3}$'`),
    check("event_plans_max_riders_check", sql`${t.maxRiders} > 0`),
    check("event_plans_max_judges_check", sql`${t.maxJudges} >= 0`),
    check("event_plans_max_organizers_check", sql`${t.maxOrganizers} >= 1`),
    check("event_plans_monthly_limit_check", sql`${t.monthlyEventLimit} > 0`),
    check("event_plans_name_check", sql`length(${t.name}) > 0`),
    check("event_plans_sort_order_check", sql`${t.sortOrder} >= 0`),
  ],
);

export const userEventPlans = pgTable(
  "user_event_plans",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    planSlug: text("plan_slug")
      .notNull()
      .references(() => eventPlans.slug, { onDelete: "restrict" }),
    source: text("source").$type<"payment" | "admin_grant">().notNull(),
    status: text("status").$type<"active" | "revoked">().notNull().default("active"),
    grantedBy: uuid("granted_by").references(() => authUsers.id, { onDelete: "set null" }),
    grantedAt: timestamp("granted_at", { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("user_event_plans_plan_slug_idx").on(t.planSlug),
    check("user_event_plans_source_check", sql`${t.source} in ('payment','admin_grant')`),
    check("user_event_plans_status_check", sql`${t.status} in ('active','revoked')`),
  ],
);

export const eventPayments = pgTable(
  "event_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references((): AnyPgColumn => sportEvents.id, { onDelete: "cascade" }),
    planSlug: text("plan_slug")
      .notNull()
      .references(() => eventPlans.slug, { onDelete: "restrict" }),
    status: text("status").$type<EventPaymentStatus>().notNull().default("pending"),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull(),
    provider: text("provider").notNull().default("manual"),
    providerReference: text("provider_reference"),
    payerUserId: uuid("payer_user_id").references(() => authUsers.id, { onDelete: "set null" }),
    markedPaidBy: uuid("marked_paid_by").references(() => authUsers.id, { onDelete: "set null" }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => authUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("event_payments_event_idx").on(t.eventId),
    index("event_payments_status_created_idx").on(t.status, t.createdAt),
    uniqueIndex("event_payments_event_active_unique")
      .on(t.eventId)
      .where(sql`${t.status} in ('pending','paid','comped')`),
    check(
      "event_payments_status_check",
      sql`${t.status} in ('pending','paid','refunded','comped','failed')`,
    ),
    check("event_payments_amount_check", sql`${t.amountCents} >= 0`),
    check("event_payments_currency_check", sql`${t.currency} ~ '^[A-Z]{3}$'`),
    check("event_payments_provider_check", sql`length(${t.provider}) > 0`),
  ],
);

// ---------- League competition (0026) ----------

export const eventInvites = pgTable(
  "event_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references((): AnyPgColumn => sportEvents.id, { onDelete: "cascade" }),
    role: text("role").$type<Exclude<EventRole, "main_organizer">>().notNull(),
    code: text("code").notNull(),
    createdBy: uuid("created_by").references(() => authUsers.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    maxUses: integer("max_uses"),
    useCount: integer("use_count").notNull().default(0),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("event_invites_code_key").on(t.code),
    index("event_invites_event_role_idx").on(t.eventId, t.role),
    check("event_invites_role_check", sql`${t.role} in ('organizer','judge','rider')`),
    check("event_invites_code_check", sql`length(${t.code}) > 0`),
    check("event_invites_use_count_check", sql`${t.useCount} >= 0`),
    check("event_invites_max_uses_check", sql`${t.maxUses} is null or ${t.maxUses} > 0`),
    check(
      "event_invites_use_count_within_max_check",
      sql`${t.maxUses} is null or ${t.useCount} <= ${t.maxUses}`,
    ),
  ],
);

export const eventMemberships = pgTable(
  "event_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references((): AnyPgColumn => sportEvents.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    role: text("role").$type<EventRole>().notNull(),
    status: text("status").$type<EventMembershipStatus>().notNull().default("active"),
    joinedViaInviteId: uuid("joined_via_invite_id").references(
      (): AnyPgColumn => eventInvites.id,
      { onDelete: "set null" },
    ),
    addedBy: uuid("added_by").references(() => authUsers.id, { onDelete: "set null" }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    removedBy: uuid("removed_by").references(() => authUsers.id, { onDelete: "set null" }),
  },
  (t) => [
    uniqueIndex("event_memberships_event_user_active_unique")
      .on(t.eventId, t.userId)
      .where(sql`${t.status} = 'active'`),
    uniqueIndex("event_memberships_main_organizer_unique")
      .on(t.eventId)
      .where(sql`${t.role} = 'main_organizer' and ${t.status} = 'active'`),
    index("event_memberships_user_status_idx").on(t.userId, t.status),
    index("event_memberships_event_role_status_idx").on(t.eventId, t.role, t.status),
    check(
      "event_memberships_role_check",
      sql`${t.role} in ('main_organizer','organizer','judge','rider')`,
    ),
    check("event_memberships_status_check", sql`${t.status} in ('active','removed','withdrawn')`),
  ],
);

export const eventScoringCriteria = pgTable(
  "event_scoring_criteria",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references((): AnyPgColumn => sportEvents.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    label: text("label").notNull(),
    weight: numeric("weight", { precision: 6, scale: 3 }).notNull().default("1"),
    maxScore: numeric("max_score", { precision: 6, scale: 2 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    unique("event_scoring_criteria_event_key_unique").on(t.eventId, t.key),
    check(
      "event_scoring_criteria_key_check",
      sql`${t.key} = lower(${t.key}) and length(${t.key}) > 0`,
    ),
    check("event_scoring_criteria_label_check", sql`length(${t.label}) > 0`),
    check("event_scoring_criteria_weight_check", sql`${t.weight} > 0`),
    check("event_scoring_criteria_max_score_check", sql`${t.maxScore} > 0`),
    check("event_scoring_criteria_sort_order_check", sql`${t.sortOrder} >= 0`),
  ],
);

export const eventRuns = pgTable(
  "event_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references((): AnyPgColumn => sportEvents.id, { onDelete: "cascade" }),
    membershipId: uuid("membership_id")
      .notNull()
      .references((): AnyPgColumn => eventMemberships.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    stage: text("stage").notNull().default("final"),
    sequence: integer("sequence").notNull(),
    status: text("status").$type<EventRunStatus>().notNull().default("scheduled"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true }),
    windowEndsAt: timestamp("window_ends_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("event_runs_event_membership_stage_unique").on(t.eventId, t.membershipId, t.stage),
    unique("event_runs_event_stage_sequence_unique").on(t.eventId, t.stage, t.sequence),
    index("event_runs_event_status_idx").on(t.eventId, t.status),
    check("event_runs_stage_check", sql`length(${t.stage}) > 0`),
    check("event_runs_sequence_check", sql`${t.sequence} > 0`),
    check(
      "event_runs_status_check",
      sql`${t.status} in ('scheduled','judging','scored','skipped','completed')`,
    ),
    check(
      "event_runs_window_after_start_check",
      sql`${t.windowEndsAt} is null or (${t.windowStartedAt} is not null and ${t.windowEndsAt} > ${t.windowStartedAt})`,
    ),
  ],
);

export const eventScores = pgTable(
  "event_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references((): AnyPgColumn => sportEvents.id, { onDelete: "cascade" }),
    runId: uuid("run_id")
      .notNull()
      .references((): AnyPgColumn => eventRuns.id, { onDelete: "cascade" }),
    judgeUserId: uuid("judge_user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    scores: jsonb("scores").$type<Record<string, number>>().notNull(),
    total: numeric("total", { precision: 8, scale: 2 }).notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("event_scores_run_judge_unique").on(t.runId, t.judgeUserId),
    index("event_scores_event_idx").on(t.eventId),
    check("event_scores_scores_shape_check", sql`jsonb_typeof(${t.scores}) = 'object'`),
    check("event_scores_total_check", sql`${t.total} >= 0`),
  ],
);

export const eventResults = pgTable(
  "event_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references((): AnyPgColumn => sportEvents.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    runId: uuid("run_id").references((): AnyPgColumn => eventRuns.id, { onDelete: "set null" }),
    totalScore: numeric("total_score", { precision: 8, scale: 2 }).notNull(),
    rank: integer("rank").notNull(),
    pointsAwarded: integer("points_awarded").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("event_results_event_user_unique").on(t.eventId, t.userId),
    unique("event_results_event_rank_unique").on(t.eventId, t.rank),
    index("event_results_user_published_idx").on(t.userId, t.publishedAt),
    check("event_results_total_check", sql`${t.totalScore} >= 0`),
    check("event_results_rank_check", sql`${t.rank} > 0`),
    check("event_results_points_check", sql`${t.pointsAwarded} >= 0`),
  ],
);

export const eventPointsLedger = pgTable(
  "event_points_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references((): AnyPgColumn => sportEvents.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    eventKey: text("event_key").notNull(),
    eventType: text("event_type").$type<"event_attended" | "event_rank_bonus">().notNull(),
    points: integer("points").notNull(),
    rank: integer("rank"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("event_points_ledger_event_key_key").on(t.eventKey),
    index("event_points_ledger_user_created_idx").on(t.userId, t.createdAt),
    index("event_points_ledger_event_idx").on(t.eventId),
    check("event_points_ledger_event_type_check", sql`${t.eventType} in ('event_attended','event_rank_bonus')`),
    check("event_points_ledger_points_check", sql`${t.points} >= 0`),
    check("event_points_ledger_event_key_check", sql`length(${t.eventKey}) > 0`),
  ],
);

// ---------- League engine plumbing (0026) ----------

export const eventActionRequests = pgTable(
  "event_action_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references((): AnyPgColumn => sportEvents.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    resultingVersion: integer("resulting_version").notNull(),
    responseMetadata: jsonb("response_metadata")
      .$type<LeagueMutationResponse>()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("event_action_requests_scope_unique").on(
      t.eventId,
      t.userId,
      t.action,
      t.idempotencyKey,
    ),
    index("event_action_requests_created_idx").on(t.createdAt),
    index("event_action_requests_user_action_key_idx").on(t.userId, t.action, t.idempotencyKey),
    index("event_action_requests_event_action_created_idx").on(t.eventId, t.action, t.createdAt),
    check("event_action_requests_version_check", sql`${t.resultingVersion} >= 0`),
  ],
);

export const eventRealtimeSignals = pgTable(
  "event_realtime_signals",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    eventId: uuid("event_id")
      .notNull()
      .references((): AnyPgColumn => sportEvents.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    signalType: text("signal_type").$type<EventSignalType>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("event_realtime_signals_event_version_unique").on(t.eventId, t.version),
    index("event_realtime_signals_event_created_idx").on(t.eventId, t.createdAt),
    check("event_realtime_signals_version_check", sql`${t.version} >= 0`),
    check(
      "event_realtime_signals_type_check",
      sql`${t.signalType} in ('event_state_changed','registration_changed','schedule_published','run_started','score_submitted','results_published','event_cancelled')`,
    ),
  ],
);

export const userNotifications = pgTable(
  "user_notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    type: text("type").$type<NotificationType>().notNull(),
    payload: jsonb("payload")
      .notNull()
      .default(sql`'{}'::jsonb`)
      .$type<NotificationPayload>(),
    eventId: uuid("event_id").references((): AnyPgColumn => sportEvents.id, {
      onDelete: "set null",
    }),
    readAt: timestamp("read_at", { withTimezone: true }),
    emailedAt: timestamp("emailed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("user_notifications_user_created_idx").on(t.userId, t.createdAt.desc()),
    index("user_notifications_user_unread_idx").on(t.userId).where(sql`${t.readAt} is null`),
    index("user_notifications_event_idx").on(t.eventId),
    index("user_notifications_email_pending_idx")
      .on(t.createdAt)
      .where(sql`${t.emailedAt} is null and ${t.type} in
        ('league_invite_received','league_registration_confirmed','league_schedule_published','league_event_started','league_event_cancelled','league_results_published','league_points_earned')`),
  ],
);

export const userEmailPreferences = pgTable(
  "user_email_preferences",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    emailDigestsEnabled: boolean("email_digests_enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export const userEmailPreferencesRelations = relations(
  userEmailPreferences,
  ({ one }) => ({
    user: one(authUsers, {
      fields: [userEmailPreferences.userId],
      references: [authUsers.id],
    }),
  }),
);

/**
 * Email-dedup ledger written by the pg_cron sweep (0030). RLS is enabled
 * with zero policies — only the privileged service connection touches it.
 */
export const leagueEmailLog = pgTable(
  "league_email_log",
  {
    eventId: uuid("event_id")
      .notNull()
      .references((): AnyPgColumn => sportEvents.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    day: integer("day").notNull(),
    recipients: text("recipients")
      .array()
      .notNull()
      .default(sql`'{}'`),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.kind, t.day] })],
);

export const spotDisciplines = pgTable(
  "spot_disciplines",
  {
    spotId: uuid("spot_id")
      .notNull()
      .references(() => spots.id, { onDelete: "cascade" }),
    disciplineSlug: text("discipline_slug")
      .notNull()
      .references(() => sportDisciplines.slug, { onDelete: "restrict" }),
  },
  (t) => [
    primaryKey({ columns: [t.spotId, t.disciplineSlug] }),
     index("spot_disciplines_discipline_idx").on(t.disciplineSlug),
     index("spot_disciplines_discipline_spot_idx").on(t.disciplineSlug, t.spotId),
  ],
);

export const eventDisciplines = pgTable(
  "event_disciplines",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => sportEvents.id, { onDelete: "cascade" }),
    disciplineSlug: text("discipline_slug")
      .notNull()
      .references(() => sportDisciplines.slug, { onDelete: "restrict" }),
  },
  (t) => [
    primaryKey({ columns: [t.eventId, t.disciplineSlug] }),
     index("event_disciplines_discipline_idx").on(t.disciplineSlug),
     index("event_disciplines_discipline_event_idx").on(t.disciplineSlug, t.eventId),
  ],
);

// Many-to-many join between `spots` and `spot_types` (mirrors the
// `spot_disciplines` / `event_disciplines` shape — the parent entity is the
// first segment of the table name, the related dimension is the
// second). `ON DELETE cascade` from the spot so removing a spot
// tears down its links; `ON DELETE restrict` on the type so removing
// a type in active use fails loudly (caller must reassign first).
export const spotTypeAssignments = pgTable(
  "spot_type_assignments",
  {
    spotId: uuid("spot_id")
      .notNull()
      .references(() => spots.id, { onDelete: "cascade" }),
    typeSlug: text("type_slug")
      .notNull()
      .references(() => spotTypes.slug, { onDelete: "restrict" }),
  },
  (t) => [
    primaryKey({ columns: [t.spotId, t.typeSlug] }),
     index("spot_type_assignments_type_idx").on(t.typeSlug),
     index("spot_type_assignments_type_spot_idx").on(t.typeSlug, t.spotId),
  ],
);

export const authUsersRelations = relations(authUsers, ({ many }) => ({
  profiles: many(profiles),
  spots: many(spots),
  sportEvents: many(sportEvents),
  gameSessions: many(gameSessions),
  gamePlayers: many(gamePlayers),
  gameActionRequests: many(gameActionRequests),
  riderStats: many(riderStats),
  riderScoreEvents: many(riderScoreEvents),
  savedSpots: many(savedSpots),
  verifiedSpots: many(verifiedSpots),
  spotWeatherVerifications: many(spotWeatherVerifications),
  userRoles: many(userRoles, { relationName: "userRolesUser" }),
  grantedUserRoles: many(userRoles, { relationName: "userRolesGrantedBy" }),
  contentAuditLogs: many(contentAuditLog),
}));

export const profilesRelations = relations(profiles, ({ one }) => ({
  authUser: one(authUsers, {
    fields: [profiles.id],
    references: [authUsers.id],
  }),
  preferredDiscipline: one(sportDisciplines, {
    fields: [profiles.preferredDisciplineSlug],
    references: [sportDisciplines.slug],
  }),
}));

export const spotsRelations = relations(spots, ({ one, many }) => ({
  country: one(countries, {
    fields: [spots.countryCode],
    references: [countries.iso2],
  }),
  creator: one(authUsers, {
    fields: [spots.createdBy],
    references: [authUsers.id],
  }),
  gameSessions: many(gameSessions),
  locationVerifications: many(gameLocationVerifications),
  challengeRecords: many(spotChallengeRecords),
  disciplines: many(spotDisciplines),
  typeAssignments: many(spotTypeAssignments),
  savedSpots: many(savedSpots),
  verifiedSpots: many(verifiedSpots),
  spotWeatherVerifications: many(spotWeatherVerifications),
}));

export const sportEventsRelations = relations(sportEvents, ({ one, many }) => ({
  category: one(eventCategories, {
    fields: [sportEvents.categorySlug],
    references: [eventCategories.slug],
  }),
  plan: one(eventPlans, {
    fields: [sportEvents.planSlug],
    references: [eventPlans.slug],
  }),
  country: one(countries, {
    fields: [sportEvents.countryCode],
    references: [countries.iso2],
  }),
  creator: one(authUsers, {
    fields: [sportEvents.createdBy],
    references: [authUsers.id],
  }),
  spot: one(spots, {
    fields: [sportEvents.spotId],
    references: [spots.id],
  }),
  disciplines: many(eventDisciplines),
  memberships: many(eventMemberships),
  invites: many(eventInvites),
  criteria: many(eventScoringCriteria),
  runs: many(eventRuns),
  payments: many(eventPayments),
  actionRequests: many(eventActionRequests),
  realtimeSignals: many(eventRealtimeSignals),
}));

export const eventPlansRelations = relations(eventPlans, ({ many }) => ({
  sportEvents: many(sportEvents),
  userPlans: many(userEventPlans),
  payments: many(eventPayments),
}));

export const eventCategoriesRelations = relations(eventCategories, ({ many }) => ({
  sportEvents: many(sportEvents),
}));

export const userEventPlansRelations = relations(userEventPlans, ({ one }) => ({
  user: one(authUsers, { fields: [userEventPlans.userId], references: [authUsers.id] }),
  plan: one(eventPlans, { fields: [userEventPlans.planSlug], references: [eventPlans.slug] }),
  grantedByUser: one(authUsers, {
    fields: [userEventPlans.grantedBy],
    references: [authUsers.id],
  }),
}));

export const eventPaymentsRelations = relations(eventPayments, ({ one }) => ({
  event: one(sportEvents, { fields: [eventPayments.eventId], references: [sportEvents.id] }),
  plan: one(eventPlans, { fields: [eventPayments.planSlug], references: [eventPlans.slug] }),
  payer: one(authUsers, { fields: [eventPayments.payerUserId], references: [authUsers.id] }),
  markedPaidByUser: one(authUsers, {
    fields: [eventPayments.markedPaidBy],
    references: [authUsers.id],
  }),
}));

export const eventInvitesRelations = relations(eventInvites, ({ one, many }) => ({
  event: one(sportEvents, { fields: [eventInvites.eventId], references: [sportEvents.id] }),
  createdByUser: one(authUsers, { fields: [eventInvites.createdBy], references: [authUsers.id] }),
  memberships: many(eventMemberships),
}));

export const eventMembershipsRelations = relations(eventMemberships, ({ one, many }) => ({
  event: one(sportEvents, { fields: [eventMemberships.eventId], references: [sportEvents.id] }),
  user: one(authUsers, { fields: [eventMemberships.userId], references: [authUsers.id] }),
  invite: one(eventInvites, {
    fields: [eventMemberships.joinedViaInviteId],
    references: [eventInvites.id],
  }),
  addedByUser: one(authUsers, { fields: [eventMemberships.addedBy], references: [authUsers.id] }),
  removedByUser: one(authUsers, { fields: [eventMemberships.removedBy], references: [authUsers.id] }),
  runs: many(eventRuns),
}));

export const eventScoringCriteriaRelations = relations(eventScoringCriteria, ({ one }) => ({
  event: one(sportEvents, {
    fields: [eventScoringCriteria.eventId],
    references: [sportEvents.id],
  }),
}));

export const eventRunsRelations = relations(eventRuns, ({ one, many }) => ({
  event: one(sportEvents, { fields: [eventRuns.eventId], references: [sportEvents.id] }),
  membership: one(eventMemberships, {
    fields: [eventRuns.membershipId],
    references: [eventMemberships.id],
  }),
  user: one(authUsers, { fields: [eventRuns.userId], references: [authUsers.id] }),
  scores: many(eventScores),
  results: many(eventResults),
}));

export const eventScoresRelations = relations(eventScores, ({ one }) => ({
  event: one(sportEvents, { fields: [eventScores.eventId], references: [sportEvents.id] }),
  run: one(eventRuns, { fields: [eventScores.runId], references: [eventRuns.id] }),
  judge: one(authUsers, { fields: [eventScores.judgeUserId], references: [authUsers.id] }),
}));

export const eventResultsRelations = relations(eventResults, ({ one }) => ({
  event: one(sportEvents, { fields: [eventResults.eventId], references: [sportEvents.id] }),
  user: one(authUsers, { fields: [eventResults.userId], references: [authUsers.id] }),
  run: one(eventRuns, { fields: [eventResults.runId], references: [eventRuns.id] }),
}));

export const eventPointsLedgerRelations = relations(eventPointsLedger, ({ one }) => ({
  event: one(sportEvents, { fields: [eventPointsLedger.eventId], references: [sportEvents.id] }),
  user: one(authUsers, { fields: [eventPointsLedger.userId], references: [authUsers.id] }),
}));

export const eventActionRequestsRelations = relations(eventActionRequests, ({ one }) => ({
  event: one(sportEvents, {
    fields: [eventActionRequests.eventId],
    references: [sportEvents.id],
  }),
  user: one(authUsers, { fields: [eventActionRequests.userId], references: [authUsers.id] }),
}));

export const eventRealtimeSignalsRelations = relations(eventRealtimeSignals, ({ one }) => ({
  event: one(sportEvents, {
    fields: [eventRealtimeSignals.eventId],
    references: [sportEvents.id],
  }),
}));

export const userNotificationsRelations = relations(userNotifications, ({ one }) => ({
  user: one(authUsers, { fields: [userNotifications.userId], references: [authUsers.id] }),
  event: one(sportEvents, {
    fields: [userNotifications.eventId],
    references: [sportEvents.id],
  }),
}));

export const countriesRelations = relations(countries, ({ one, many }) => ({
  region: one(regions, {
    fields: [countries.regionId],
    references: [regions.id],
  }),
  cities: many(cities),
  spots: many(spots),
  sportEvents: many(sportEvents),
}));

export const citiesRelations = relations(cities, ({ one }) => ({
  country: one(countries, {
    fields: [cities.countryCode],
    references: [countries.iso2],
  }),
}));

export const regionsRelations = relations(regions, ({ many }) => ({
  countries: many(countries),
}));

export const sportDisciplinesRelations = relations(sportDisciplines, ({ many }) => ({
  profiles: many(profiles),
  trickDefinitions: many(trickDefinitions),
  trickCatalogStates: many(trickCatalogStates),
  challengeCatalogs: many(challengeCatalogs),
  spotDisciplines: many(spotDisciplines),
  eventDisciplines: many(eventDisciplines),
}));

export const spotDisciplinesRelations = relations(spotDisciplines, ({ one }) => ({
  spot: one(spots, { fields: [spotDisciplines.spotId], references: [spots.id] }),
  discipline: one(sportDisciplines, {
    fields: [spotDisciplines.disciplineSlug],
    references: [sportDisciplines.slug],
  }),
}));

export const eventDisciplinesRelations = relations(eventDisciplines, ({ one }) => ({
  event: one(sportEvents, {
    fields: [eventDisciplines.eventId],
    references: [sportEvents.id],
  }),
  discipline: one(sportDisciplines, {
    fields: [eventDisciplines.disciplineSlug],
    references: [sportDisciplines.slug],
  }),
}));

export const spotTypeAssignmentsRelations = relations(spotTypeAssignments, ({ one }) => ({
  spot: one(spots, { fields: [spotTypeAssignments.spotId], references: [spots.id] }),
  type: one(spotTypes, {
    fields: [spotTypeAssignments.typeSlug],
    references: [spotTypes.slug],
  }),
}));

export const spotTypesRelations = relations(spotTypes, ({ many }) => ({
  typeAssignments: many(spotTypeAssignments),
  trickDefinitionSpotTypes: many(trickDefinitionSpotTypes),
  challengeTrickSpotTypes: many(challengeTrickSpotTypes),
}));

export const trickDefinitionsRelations = relations(trickDefinitions, ({ one, many }) => ({
  discipline: one(sportDisciplines, {
    fields: [trickDefinitions.disciplineSlug],
    references: [sportDisciplines.slug],
  }),
  spotTypes: many(trickDefinitionSpotTypes),
}));

export const trickDefinitionSpotTypesRelations = relations(trickDefinitionSpotTypes, ({ one }) => ({
  trick: one(trickDefinitions, {
    fields: [trickDefinitionSpotTypes.trickId],
    references: [trickDefinitions.id],
  }),
  spotType: one(spotTypes, {
    fields: [trickDefinitionSpotTypes.spotTypeSlug],
    references: [spotTypes.slug],
  }),
}));

export const trickCatalogStatesRelations = relations(trickCatalogStates, ({ one }) => ({
  discipline: one(sportDisciplines, {
    fields: [trickCatalogStates.disciplineSlug],
    references: [sportDisciplines.slug],
  }),
}));

export const challengeCatalogsRelations = relations(challengeCatalogs, ({ one, many }) => ({
  discipline: one(sportDisciplines, {
    fields: [challengeCatalogs.disciplineSlug],
    references: [sportDisciplines.slug],
  }),
  tricks: many(challengeCatalogTricks),
  gameSessions: many(gameSessions),
}));

export const challengeCatalogTricksRelations = relations(challengeCatalogTricks, ({ one, many }) => ({
  catalog: one(challengeCatalogs, {
    fields: [challengeCatalogTricks.catalogId],
    references: [challengeCatalogs.id],
  }),
  rounds: many(gameRounds),
  spotTypes: many(challengeTrickSpotTypes),
}));

export const challengeTrickSpotTypesRelations = relations(challengeTrickSpotTypes, ({ one }) => ({
  trick: one(challengeCatalogTricks, {
    fields: [challengeTrickSpotTypes.trickId],
    references: [challengeCatalogTricks.id],
  }),
  spotType: one(spotTypes, {
    fields: [challengeTrickSpotTypes.spotTypeSlug],
    references: [spotTypes.slug],
  }),
}));

export const gameSessionsRelations = relations(gameSessions, ({ one, many }) => ({
  catalog: one(challengeCatalogs, {
    fields: [gameSessions.catalogId],
    references: [challengeCatalogs.id],
  }),
  spot: one(spots, {
    fields: [gameSessions.spotId],
    references: [spots.id],
  }),
  creator: one(authUsers, {
    fields: [gameSessions.createdBy],
    references: [authUsers.id],
  }),
  winnerPlayer: one(gamePlayers, {
    fields: [gameSessions.id, gameSessions.winnerPlayerId],
    references: [gamePlayers.gameId, gamePlayers.id],
    relationName: "gameSessionWinner",
  }),
  currentRound: one(gameRounds, {
    fields: [gameSessions.id, gameSessions.currentRoundId],
    references: [gameRounds.gameId, gameRounds.id],
    relationName: "gameSessionCurrentRound",
  }),
  currentChallenger: one(gamePlayers, {
    fields: [gameSessions.id, gameSessions.currentChallengerPlayerId],
    references: [gamePlayers.gameId, gamePlayers.id],
    relationName: "gameSessionCurrentChallenger",
  }),
  players: many(gamePlayers, { relationName: "gameSessionPlayers" }),
  rounds: many(gameRounds, { relationName: "gameSessionRounds" }),
  actionRequests: many(gameActionRequests),
  locationVerifications: many(gameLocationVerifications),
  challengeRecords: many(spotChallengeRecords),
  scoreEvents: many(riderScoreEvents),
  raceLaps: many(gameRaceLaps),
  realtimeSignals: many(gameRealtimeSignals),
}));

export const gamePlayersRelations = relations(gamePlayers, ({ one, many }) => ({
  game: one(gameSessions, {
    fields: [gamePlayers.gameId],
    references: [gameSessions.id],
    relationName: "gameSessionPlayers",
  }),
  user: one(authUsers, {
    fields: [gamePlayers.userId],
    references: [authUsers.id],
  }),
  winningSessions: many(gameSessions, { relationName: "gameSessionWinner" }),
  currentChallengerSessions: many(gameSessions, { relationName: "gameSessionCurrentChallenger" }),
  challengerRounds: many(gameRounds, { relationName: "gameRoundChallenger" }),
  levelSelectedRounds: many(gameRounds, { relationName: "gameRoundLevelSelected" }),
  spotTypeChangedRounds: many(gameRounds, { relationName: "gameRoundSpotTypeChanged" }),
  attempts: many(gameAttempts),
  locationVerifications: many(gameLocationVerifications),
  challengeRecords: many(spotChallengeRecords),
  raceLaps: many(gameRaceLaps),
}));

export const gameRoundsRelations = relations(gameRounds, ({ one, many }) => ({
  game: one(gameSessions, {
    fields: [gameRounds.gameId],
    references: [gameSessions.id],
    relationName: "gameSessionRounds",
  }),
  catalogTrick: one(challengeCatalogTricks, {
    fields: [gameRounds.catalogTrickId],
    references: [challengeCatalogTricks.id],
  }),
  challenger: one(gamePlayers, {
    fields: [gameRounds.gameId, gameRounds.challengerPlayerId],
    references: [gamePlayers.gameId, gamePlayers.id],
    relationName: "gameRoundChallenger",
  }),
  levelSelectedBy: one(gamePlayers, {
    fields: [gameRounds.gameId, gameRounds.levelSelectedByPlayerId],
    references: [gamePlayers.gameId, gamePlayers.id],
    relationName: "gameRoundLevelSelected",
  }),
  spotTypeChangedBy: one(gamePlayers, {
    fields: [gameRounds.gameId, gameRounds.spotTypeChangedByPlayerId],
    references: [gamePlayers.gameId, gamePlayers.id],
    relationName: "gameRoundSpotTypeChanged",
  }),
  attempts: many(gameAttempts),
  locationVerifications: many(gameLocationVerifications),
  scoreEventsByGame: many(riderScoreEvents, { relationName: "riderScoreRoundByGame" }),
  scoreEventsByRound: many(riderScoreEvents, { relationName: "riderScoreRoundById" }),
}));

export const gameAttemptsRelations = relations(gameAttempts, ({ one }) => ({
  round: one(gameRounds, {
    fields: [gameAttempts.roundId],
    references: [gameRounds.id],
  }),
  player: one(gamePlayers, {
    fields: [gameAttempts.playerId],
    references: [gamePlayers.id],
  }),
}));

export const gameActionRequestsRelations = relations(gameActionRequests, ({ one }) => ({
  game: one(gameSessions, {
    fields: [gameActionRequests.gameId],
    references: [gameSessions.id],
  }),
  user: one(authUsers, {
    fields: [gameActionRequests.userId],
    references: [authUsers.id],
  }),
}));

export const gameLocationVerificationsRelations = relations(gameLocationVerifications, ({ one }) => ({
  game: one(gameSessions, {
    fields: [gameLocationVerifications.gameId],
    references: [gameSessions.id],
  }),
  round: one(gameRounds, {
    fields: [gameLocationVerifications.roundId],
    references: [gameRounds.id],
  }),
  player: one(gamePlayers, {
    fields: [gameLocationVerifications.gameId, gameLocationVerifications.playerId],
    references: [gamePlayers.gameId, gamePlayers.id],
  }),
  spot: one(spots, {
    fields: [gameLocationVerifications.spotId],
    references: [spots.id],
  }),
}));

export const spotChallengeRecordsRelations = relations(spotChallengeRecords, ({ one }) => ({
  game: one(gameSessions, {
    fields: [spotChallengeRecords.gameId],
    references: [gameSessions.id],
  }),
  spot: one(spots, {
    fields: [spotChallengeRecords.spotId],
    references: [spots.id],
  }),
  winner: one(gamePlayers, {
    fields: [spotChallengeRecords.gameId, spotChallengeRecords.winnerPlayerId],
    references: [gamePlayers.gameId, gamePlayers.id],
  }),
}));

export const riderStatsRelations = relations(riderStats, ({ one }) => ({
  user: one(authUsers, {
    fields: [riderStats.userId],
    references: [authUsers.id],
  }),
}));

export const riderScoreEventsRelations = relations(riderScoreEvents, ({ one }) => ({
  game: one(gameSessions, {
    fields: [riderScoreEvents.gameId],
    references: [gameSessions.id],
  }),
  roundByGame: one(gameRounds, {
    fields: [riderScoreEvents.gameId, riderScoreEvents.roundId],
    references: [gameRounds.gameId, gameRounds.id],
    relationName: "riderScoreRoundByGame",
  }),
  roundById: one(gameRounds, {
    fields: [riderScoreEvents.roundId],
    references: [gameRounds.id],
    relationName: "riderScoreRoundById",
  }),
  user: one(authUsers, {
    fields: [riderScoreEvents.userId],
    references: [authUsers.id],
  }),
}));

export const gameRaceLapsRelations = relations(gameRaceLaps, ({ one }) => ({
  game: one(gameSessions, {
    fields: [gameRaceLaps.gameId],
    references: [gameSessions.id],
  }),
  player: one(gamePlayers, {
    fields: [gameRaceLaps.gameId, gameRaceLaps.playerId],
    references: [gamePlayers.gameId, gamePlayers.id],
  }),
}));

export const gameRealtimeSignalsRelations = relations(gameRealtimeSignals, ({ one }) => ({
  game: one(gameSessions, {
    fields: [gameRealtimeSignals.gameId],
    references: [gameSessions.id],
  }),
}));

export const savedSpotsRelations = relations(savedSpots, ({ one }) => ({
  spot: one(spots, { fields: [savedSpots.spotId], references: [spots.id] }),
  user: one(authUsers, { fields: [savedSpots.userId], references: [authUsers.id] }),
}));

export const verifiedSpotsRelations = relations(verifiedSpots, ({ one }) => ({
  spot: one(spots, { fields: [verifiedSpots.spotId], references: [spots.id] }),
  user: one(authUsers, { fields: [verifiedSpots.userId], references: [authUsers.id] }),
}));

export const spotWeatherVerificationsRelations = relations(spotWeatherVerifications, ({ one }) => ({
  spot: one(spots, { fields: [spotWeatherVerifications.spotId], references: [spots.id] }),
  user: one(authUsers, { fields: [spotWeatherVerifications.userId], references: [authUsers.id] }),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, { fields: [rolePermissions.roleId], references: [roles.id] }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
  }),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  rolePermissions: many(rolePermissions),
  userRoles: many(userRoles),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(authUsers, {
    fields: [userRoles.userId],
    references: [authUsers.id],
    relationName: "userRolesUser",
  }),
  role: one(roles, { fields: [userRoles.roleId], references: [roles.id] }),
  grantedBy: one(authUsers, {
    fields: [userRoles.grantedBy],
    references: [authUsers.id],
    relationName: "userRolesGrantedBy",
  }),
}));

export const curatorCountryScopesRelations = relations(curatorCountryScopes, ({ one }) => ({
  user: one(authUsers, { fields: [curatorCountryScopes.userId], references: [authUsers.id] }),
  country: one(countries, { fields: [curatorCountryScopes.countryCode], references: [countries.iso2] }),
  grantedByUser: one(authUsers, { fields: [curatorCountryScopes.grantedBy], references: [authUsers.id] }),
}))

export const curatorDisciplineScopesRelations = relations(curatorDisciplineScopes, ({ one }) => ({
  user: one(authUsers, { fields: [curatorDisciplineScopes.userId], references: [authUsers.id] }),
  discipline: one(sportDisciplines, { fields: [curatorDisciplineScopes.disciplineSlug], references: [sportDisciplines.slug] }),
  grantedByUser: one(authUsers, { fields: [curatorDisciplineScopes.grantedBy], references: [authUsers.id] }),
}))

export type SpotRow = typeof spots.$inferSelect;
export type NewSpotRow = typeof spots.$inferInsert;
export type SpotImageRow = typeof spotImages.$inferSelect;
export type NewSpotImageRow = typeof spotImages.$inferInsert;
export type SportEventRow = typeof sportEvents.$inferSelect;
export type NewSportEventRow = typeof sportEvents.$inferInsert;
export type SavedSpotRow = typeof savedSpots.$inferSelect;
export type NewSavedSpotRow = typeof savedSpots.$inferInsert;
export type VerifiedSpotRow = typeof verifiedSpots.$inferSelect;
export type NewVerifiedSpotRow = typeof verifiedSpots.$inferInsert;
export type SpotWeatherVerificationRow = typeof spotWeatherVerifications.$inferSelect;
export type NewSpotWeatherVerificationRow = typeof spotWeatherVerifications.$inferInsert;
export type ProfileRow = typeof profiles.$inferSelect;
export type NewProfileRow = typeof profiles.$inferInsert;
export type AuthUserRow = typeof authUsers.$inferSelect;
export type GameSessionRow = typeof gameSessions.$inferSelect;
export type NewGameSessionRow = typeof gameSessions.$inferInsert;
export type GamePlayerRow = typeof gamePlayers.$inferSelect;
export type NewGamePlayerRow = typeof gamePlayers.$inferInsert;
export type GameRoundRow = typeof gameRounds.$inferSelect;
export type NewGameRoundRow = typeof gameRounds.$inferInsert;
export type GameAttemptRow = typeof gameAttempts.$inferSelect;
export type NewGameAttemptRow = typeof gameAttempts.$inferInsert;
export type GameActionRequestRow = typeof gameActionRequests.$inferSelect;
export type NewGameActionRequestRow = typeof gameActionRequests.$inferInsert;
export type GameLocationVerificationRow = typeof gameLocationVerifications.$inferSelect;
export type NewGameLocationVerificationRow = typeof gameLocationVerifications.$inferInsert;
export type GameRaceLapRow = typeof gameRaceLaps.$inferSelect;
export type NewGameRaceLapRow = typeof gameRaceLaps.$inferInsert;
export type GameRealtimeSignalRow = typeof gameRealtimeSignals.$inferSelect;
export type NewGameRealtimeSignalRow = typeof gameRealtimeSignals.$inferInsert;
export type SpotChallengeRecordRow = typeof spotChallengeRecords.$inferSelect;
export type NewSpotChallengeRecordRow = typeof spotChallengeRecords.$inferInsert;
export type RiderStatsRow = typeof riderStats.$inferSelect;
export type NewRiderStatsRow = typeof riderStats.$inferInsert;
export type RiderScoreEventRow = typeof riderScoreEvents.$inferSelect;
export type NewRiderScoreEventRow = typeof riderScoreEvents.$inferInsert;
export type RoleRow = typeof roles.$inferSelect;
export type NewRoleRow = typeof roles.$inferInsert;
export type PermissionRow = typeof permissions.$inferSelect;
export type NewPermissionRow = typeof permissions.$inferInsert;
export type RolePermissionRow = typeof rolePermissions.$inferSelect;
export type NewRolePermissionRow = typeof rolePermissions.$inferInsert;
export type UserRoleRow = typeof userRoles.$inferSelect;
export type NewUserRoleRow = typeof userRoles.$inferInsert;
export type CuratorCountryScopeRow = typeof curatorCountryScopes.$inferSelect;
export type NewCuratorCountryScopeRow = typeof curatorCountryScopes.$inferInsert;
export type CuratorDisciplineScopeRow = typeof curatorDisciplineScopes.$inferSelect;
export type NewCuratorDisciplineScopeRow = typeof curatorDisciplineScopes.$inferInsert;
export type ContentAuditLogRow = typeof contentAuditLog.$inferSelect;
export type NewContentAuditLogRow = typeof contentAuditLog.$inferInsert;
export type TrickDefinitionRow = typeof trickDefinitions.$inferSelect;
export type NewTrickDefinitionRow = typeof trickDefinitions.$inferInsert;
export type TrickDefinitionSpotTypeRow = typeof trickDefinitionSpotTypes.$inferSelect;
export type NewTrickDefinitionSpotTypeRow = typeof trickDefinitionSpotTypes.$inferInsert;
export type TrickCatalogStateRow = typeof trickCatalogStates.$inferSelect;
export type NewTrickCatalogStateRow = typeof trickCatalogStates.$inferInsert;
export type ChallengeCatalogRow = typeof challengeCatalogs.$inferSelect;
export type NewChallengeCatalogRow = typeof challengeCatalogs.$inferInsert;
export type ChallengeCatalogTrickRow = typeof challengeCatalogTricks.$inferSelect;
export type NewChallengeCatalogTrickRow = typeof challengeCatalogTricks.$inferInsert;
export type ChallengeTrickSpotTypeRow = typeof challengeTrickSpotTypes.$inferSelect;
export type NewChallengeTrickSpotTypeRow = typeof challengeTrickSpotTypes.$inferInsert;

export type SpotTypeAssignmentRow = typeof spotTypeAssignments.$inferSelect;
export type NewSpotTypeAssignmentRow = typeof spotTypeAssignments.$inferInsert;

export type TvVideoRow = typeof tvVideos.$inferSelect;
export type NewTvVideoRow = typeof tvVideos.$inferInsert;

export type RegionRow = typeof regions.$inferSelect;
export type NewRegionRow = typeof regions.$inferInsert;
export type CountryRow = typeof countries.$inferSelect;
export type NewCountryRow = typeof countries.$inferInsert;
export type CityRow = typeof cities.$inferSelect;
export type NewCityRow = typeof cities.$inferInsert;
export type SpotTypeRow = typeof spotTypes.$inferSelect;
export type NewSpotTypeRow = typeof spotTypes.$inferInsert;
export type SportDisciplineRow = typeof sportDisciplines.$inferSelect;
export type NewSportDisciplineRow = typeof sportDisciplines.$inferInsert;
export type EventCategoryRow = typeof eventCategories.$inferSelect;
export type NewEventCategoryRow = typeof eventCategories.$inferInsert;
export type EventPlanRow = typeof eventPlans.$inferSelect;
export type NewEventPlanRow = typeof eventPlans.$inferInsert;
export type UserEventPlanRow = typeof userEventPlans.$inferSelect;
export type NewUserEventPlanRow = typeof userEventPlans.$inferInsert;
export type EventPaymentRow = typeof eventPayments.$inferSelect;
export type NewEventPaymentRow = typeof eventPayments.$inferInsert;
export type EventInviteRow = typeof eventInvites.$inferSelect;
export type NewEventInviteRow = typeof eventInvites.$inferInsert;
export type EventMembershipRow = typeof eventMemberships.$inferSelect;
export type NewEventMembershipRow = typeof eventMemberships.$inferInsert;
export type EventScoringCriterionRow = typeof eventScoringCriteria.$inferSelect;
export type NewEventScoringCriterionRow = typeof eventScoringCriteria.$inferInsert;
export type EventRunRow = typeof eventRuns.$inferSelect;
export type NewEventRunRow = typeof eventRuns.$inferInsert;
export type EventScoreRow = typeof eventScores.$inferSelect;
export type NewEventScoreRow = typeof eventScores.$inferInsert;
export type EventResultRow = typeof eventResults.$inferSelect;
export type NewEventResultRow = typeof eventResults.$inferInsert;
export type EventPointsLedgerRow = typeof eventPointsLedger.$inferSelect;
export type NewEventPointsLedgerRow = typeof eventPointsLedger.$inferInsert;
export type EventActionRequestRow = typeof eventActionRequests.$inferSelect;
export type NewEventActionRequestRow = typeof eventActionRequests.$inferInsert;
export type EventRealtimeSignalRow = typeof eventRealtimeSignals.$inferSelect;
export type NewEventRealtimeSignalRow = typeof eventRealtimeSignals.$inferInsert;
export type UserNotificationRow = typeof userNotifications.$inferSelect;
export type NewUserNotificationRow = typeof userNotifications.$inferInsert;
export type LeagueEmailLogRow = typeof leagueEmailLog.$inferSelect;
export type NewLeagueEmailLogRow = typeof leagueEmailLog.$inferInsert;
export type SpotDisciplineRow = typeof spotDisciplines.$inferSelect;
export type NewSpotDisciplineRow = typeof spotDisciplines.$inferInsert;
export type EventDisciplineRow = typeof eventDisciplines.$inferSelect;
export type NewEventDisciplineRow = typeof eventDisciplines.$inferInsert;

export const shortLinks = pgTable(
  "short_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    targetUrl: text("target_url").notNull(),
    title: text("title"),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("short_links_code_idx").on(t.code),
    uniqueIndex("short_links_target_url_idx").on(t.targetUrl),
    check("short_links_code_check", sql`length(${t.code}) >= 4 and length(${t.code}) <= 32`),
    check("short_links_target_url_check", sql`length(${t.targetUrl}) > 0 and length(${t.targetUrl}) <= 2048`),
  ],
);

export type ShortLink = typeof shortLinks.$inferSelect;
export type NewShortLink = typeof shortLinks.$inferInsert;
export type ShortLinkRow = typeof shortLinks.$inferSelect;
export type NewShortLinkRow = typeof shortLinks.$inferInsert;
