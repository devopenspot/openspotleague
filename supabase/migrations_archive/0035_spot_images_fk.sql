-- Spot images integrity (0035). `spot_images` shipped without a foreign key,
-- which let 9k+ rows orphan on this deployment. Clean the orphans once, then
-- enforce `spot_id → spots(id) ON DELETE CASCADE` so image rows always die
-- with their spot.
--> statement-breakpoint

DELETE FROM "spot_images"
  WHERE NOT EXISTS (SELECT 1 FROM "spots" WHERE "spots"."id" = "spot_images"."spot_id");
--> statement-breakpoint

ALTER TABLE "spot_images"
  ADD CONSTRAINT "spot_images_spot_id_fkey"
  FOREIGN KEY ("spot_id") REFERENCES "spots"("id") ON DELETE CASCADE;
