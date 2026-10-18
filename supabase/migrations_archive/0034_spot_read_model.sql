-- Spot read model (0034) — repo mirror of a migration previously applied to
-- this deployment out-of-band (this environment's `schema_migrations` ledger
-- already carries the id, so `db:apply` skips it here; fresh databases
-- execute it verbatim).
-- 1. `spots.types` / `spots.sports`: denormalized display columns written
--    alongside `spot_type_assignments` / `spot_disciplines` (type snapshots
--    `{name, slug}`; capitalized sport names).
-- 2. `spot_images`: multi-image spot support (one row per stored image
--    variant master; CDN keys `spots/<spotId>/<imageId>[.webp]`).
--> statement-breakpoint

ALTER TABLE "spots" ADD COLUMN IF NOT EXISTS "types" jsonb NOT NULL DEFAULT '[]'::jsonb;
--> statement-breakpoint

ALTER TABLE "spots" ADD COLUMN IF NOT EXISTS "sports" text[] NOT NULL DEFAULT '{}'::text[];
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "spot_images" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "spot_id" uuid NOT NULL,
  "path" text NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "spot_images_path_check" CHECK (("path")::text <> '' AND length("path") > 0),
  CONSTRAINT "spot_images_sort_order_check" CHECK ("sort_order" >= 0),
  CONSTRAINT "spot_images_spot_path_key" UNIQUE ("spot_id", "path")
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "spot_images_spot_id_sort_order_idx"
  ON "spot_images" ("spot_id", "sort_order");
--> statement-breakpoint

ALTER TABLE "spot_images" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "spot_images_select_public"
  ON "spot_images" FOR SELECT TO anon, authenticated USING (true);
