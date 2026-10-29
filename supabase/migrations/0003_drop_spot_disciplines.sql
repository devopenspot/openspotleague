-- 0003: Consolidate spot disciplines onto spots.sports (text[]) and drop spot_disciplines.
-- Drops the deferred trigger enforce_spot_discipline_presence(), backfills any spots
-- whose sports array is empty from spot_disciplines + sport_disciplines, drops the
-- 112.5k-row spot_disciplines junction table, and adds a CHECK constraint + GIN index on spots.sports.

DROP TRIGGER IF EXISTS "spots_require_discipline" ON "spots";
--> statement-breakpoint
DROP FUNCTION IF EXISTS public.enforce_spot_discipline_presence();
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'spot_disciplines'
  ) THEN
    UPDATE "spots" s
    SET "sports" = sub.names
    FROM (
      SELECT
        sd.spot_id,
        array_agg(d.name ORDER BY d.name) AS names
      FROM "spot_disciplines" sd
      JOIN "sport_disciplines" d ON d.slug = sd.discipline_slug
      GROUP BY sd.spot_id
    ) sub
    WHERE s.id = sub.spot_id
      AND cardinality(s.sports) = 0;
  END IF;

  UPDATE "spots"
  SET "sports" = ARRAY['BMX', 'Roller', 'Scooter', 'Skateboard']::text[]
  WHERE cardinality("sports") = 0
     OR NOT ("sports" <@ ARRAY['BMX', 'Roller', 'Scooter', 'Skateboard']::text[])
     OR array_position("sports", NULL) IS NOT NULL;
END
$$;
--> statement-breakpoint
DROP TABLE IF EXISTS "spot_disciplines";
--> statement-breakpoint
ALTER TABLE "spots" DROP CONSTRAINT IF EXISTS "spots_sports_check";
--> statement-breakpoint
ALTER TABLE "spots" ADD CONSTRAINT "spots_sports_check"
  CHECK (
    cardinality("sports") >= 1
    AND cardinality("sports") <= 4
    AND "sports" <@ ARRAY['BMX', 'Roller', 'Scooter', 'Skateboard']::text[]
    AND array_position("sports", NULL) IS NULL
  );
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "spots_sports_gin_idx" ON "spots" USING gin ("sports");
