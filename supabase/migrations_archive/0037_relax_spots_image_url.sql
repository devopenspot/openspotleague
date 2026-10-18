-- 0037: relax spots.image_url — allow NULL / '' (no photo).
--
-- Some seed rows reference `https://placeholder.local/...` URLs that
-- decode to storage keys which do not exist in R2, and the spot read
-- path already treats NULL/'' as "no photo" (rowToSpot normalizes to
-- '', list reads exclude them via the `hasImage` filter). The DB now
-- matches: drop the NOT NULL bound on the column and the
-- spots_image_url_check constraint so placeholder rows can be blanked.
--
-- No data changes here — placeholder rows are blanked out of band with:
--   update spots
--      set image_url = ''
--    where image_url like 'https://placeholder.local/%';
--
-- sport_events keeps its stricter image_url constraint intentionally;
-- this file only relaxes spots.

alter table spots alter column image_url drop not null;

alter table spots drop constraint spots_image_url_check;
