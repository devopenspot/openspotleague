ALTER TABLE "profiles" DROP CONSTRAINT IF EXISTS "profiles_preferred_discipline_slug_sport_disciplines_slug_fk";
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "profiles" ADD CONSTRAINT "profiles_preferred_discipline_slug_check"
    CHECK ("preferred_discipline_slug" IS NULL OR "preferred_discipline_slug" IN ('roller', 'skateboard', 'bmx', 'scooter', 'all'));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
