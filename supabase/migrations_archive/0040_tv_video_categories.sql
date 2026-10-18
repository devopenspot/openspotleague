-- 0040: Migrate tv_videos.category (single enum-checked text) to tv_videos.categories (text[] multi-category).
-- Preserves existing rows by backfilling categories = ARRAY[lower(trim(category))], drops the legacy column/check/index,
-- and adds a non-empty bounded array check + GIN index for category containment queries.

ALTER TABLE "tv_videos" ADD COLUMN IF NOT EXISTS "categories" text[] NOT NULL DEFAULT '{}'::text[];
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tv_videos'
      AND column_name = 'category'
  ) THEN
    EXECUTE '
      UPDATE "tv_videos"
      SET "categories" = ARRAY[lower(trim("category"))]
      WHERE "category" IS NOT NULL
        AND trim("category") <> ''''
        AND cardinality("categories") = 0
    ';
  END IF;

  UPDATE "tv_videos"
  SET "categories" = ARRAY['profile']::text[]
  WHERE cardinality("categories") = 0;
END
$$;
--> statement-breakpoint

ALTER TABLE "tv_videos" DROP CONSTRAINT IF EXISTS "tv_videos_category_check";
--> statement-breakpoint
DROP INDEX IF EXISTS "tv_videos_category_idx";
--> statement-breakpoint
ALTER TABLE "tv_videos" DROP COLUMN IF EXISTS "category";
--> statement-breakpoint

ALTER TABLE "tv_videos" DROP CONSTRAINT IF EXISTS "tv_videos_categories_check";
--> statement-breakpoint
ALTER TABLE "tv_videos" ADD CONSTRAINT "tv_videos_categories_check"
  CHECK (
    cardinality("categories") >= 1
    AND cardinality("categories") <= 12
    AND array_position("categories", '') IS NULL
    AND array_position("categories", NULL) IS NULL
  );
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "tv_videos_categories_gin_idx" ON "tv_videos" USING gin ("categories");
--> statement-breakpoint
