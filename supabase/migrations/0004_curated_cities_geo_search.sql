-- 0004: Add spatial coordinates, admin1 state/province, featured flag, and denormalized spot_count to cities;
-- add trigram and composite public indexes for fast city + spot search and single-RTT map scope queries.

ALTER TABLE "cities" ADD COLUMN IF NOT EXISTS "admin1" text;
--> statement-breakpoint
ALTER TABLE "cities" ADD COLUMN IF NOT EXISTS "location" geography(Point,4326);
--> statement-breakpoint
ALTER TABLE "cities" ADD COLUMN IF NOT EXISTS "featured" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "cities" ADD COLUMN IF NOT EXISTS "spot_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
DO $$
BEGIN
  UPDATE "cities" c
  SET
    "location" = ST_SetSRID(ST_MakePoint(sub.lon, sub.lat), 4326)::geography,
    "spot_count" = sub.cnt
  FROM (
    SELECT
      s.country_code,
      s.city_slug,
      AVG(ST_Y(s.location::geometry)) AS lat,
      AVG(ST_X(s.location::geometry)) AS lon,
      COUNT(*) FILTER (WHERE s.visibility = 'public' AND s.admin_hidden = false)::int AS cnt
    FROM "spots" s
    GROUP BY s.country_code, s.city_slug
  ) sub
  WHERE c.country_code = sub.country_code
    AND c.slug = sub.city_slug
    AND c.location IS NULL;

  UPDATE "cities"
  SET "location" = ST_SetSRID(ST_MakePoint(0, 0), 4326)::geography
  WHERE "location" IS NULL;
END
$$;
--> statement-breakpoint
ALTER TABLE "cities" ALTER COLUMN "location" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "cities" DROP CONSTRAINT IF EXISTS "cities_spot_count_check";
--> statement-breakpoint
ALTER TABLE "cities" ADD CONSTRAINT "cities_spot_count_check" CHECK ("cities"."spot_count" >= 0);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cities_country_code_spots_idx" ON "cities" USING btree ("country_code","spot_count","name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cities_location_gist_idx" ON "cities" USING gist ("location");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cities_name_trgm_idx" ON "cities" USING gin (lower("name") gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "spots_country_city_slug_public_idx" ON "spots" USING btree ("country_code","city_slug","admin_hidden","visibility");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "spots_name_trgm_idx" ON "spots" USING gin (lower("name") gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "spots_city_trgm_idx" ON "spots" USING gin (lower("city") gin_trgm_ops);
