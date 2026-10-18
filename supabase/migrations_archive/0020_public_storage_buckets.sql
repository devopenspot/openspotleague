-- Public image buckets: switch read path to immutable public URLs + Basic CDN cached egress.
-- The app uploads with cacheControl `public, max-age=31536000, immutable` (src/lib/supabase/storage.ts:34)
-- and never overwrites in place (spots/{spotId}/{uuid}.webp), so no stale-cache purge concern.
-- Writes remain gated: spot insert/update/delete must own the spot or have media.manage.
-- Reads of public buckets bypass Storage RLS entirely via /object/public/, but we
-- also allow anon SELECT for any SDK path that still hits the authenticated endpoint.
-- See plan Phase 0.

-- storage.buckets is owned by the storage schema — direct update is the canonical
-- way to flip public. RLS handles object-level authorization separately.
UPDATE storage.buckets SET public = true WHERE id = 'spot-images';
--> statement-breakpoint
UPDATE storage.buckets SET public = true WHERE id = 'event-images';
--> statement-breakpoint

-- Keep write policies as-is. Relax read policies to allow anonymous reads so any
-- residual authenticated `storage.from(bucket).download()` still works for anon.
-- For public buckets the preferred path is /object/public/ which bypasses RLS,
-- but adding anon makes the intent explicit and keeps verify-phase-7 happy.
DROP POLICY IF EXISTS "spot_images_select" ON storage.objects;
--> statement-breakpoint
CREATE POLICY "spot_images_select" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'spot-images');
--> statement-breakpoint
DROP POLICY IF EXISTS "event_images_select" ON storage.objects;
--> statement-breakpoint
CREATE POLICY "event_images_select" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'event-images');
--> statement-breakpoint
