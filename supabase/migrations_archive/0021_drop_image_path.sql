-- Drop obsolete image_path columns — image_url now holds the full R2 CDN URL
-- (https://spots.cdn.openspotleague.com/spots/... / https://events.cdn...).
-- Backfill: migrate any remaining image_path rows to CDN URL before dropping,
-- then drop the columns. Safe to re-run: backfill is idempotent, drop guarded.
-- Needs R2_PUBLIC_DOMAIN_* on Vercel but migration does not require it.

-- Backfill spots: reconstruct CDN URL from image_path if image_url is still placeholder
UPDATE public.spots
SET image_url = 'https://spots.cdn.openspotleague.com/' || image_path
WHERE image_path IS NOT NULL
  AND (image_url LIKE 'https://placeholder.local/%' OR image_url = '');

--> statement-breakpoint
UPDATE public.sport_events
SET image_url = 'https://events.cdn.openspotleague.com/' || image_path
WHERE image_path IS NOT NULL
  AND (image_url LIKE 'https://placeholder.local/%' OR image_url = '');

--> statement-breakpoint
-- For rows where image_url already holds a non-placeholder URL (new R2 writes),
-- just null-check: no backfill needed. Ensure any stray placeholder rows are fixed
-- even if image_path already nulled: keep as-is — they will be re-uploaded.

ALTER TABLE public.spots DROP COLUMN IF EXISTS image_path;
--> statement-breakpoint
ALTER TABLE public.sport_events DROP COLUMN IF EXISTS image_path;
--> statement-breakpoint
