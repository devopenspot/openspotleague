-- 0039: lock down PostGIS `spatial_ref_sys` (advisor `rls_disabled_in_public`).
--
-- `public.spatial_ref_sys` is created by `CREATE EXTENSION postgis` (see
-- `0000_baseline.sql`) and holds public EPSG reference data — no app/PII
-- data, and the app never queries it via PostgREST (Drizzle-direct only).
-- Reads must stay open: PostGIS `ST_Transform` / geography ops do SRID
-- lookups against it. The real risk is public *writes* via
-- `/rest/v1/spatial_ref_sys` when RLS is off.
--
-- Production wall: on Supabase managed the table is owned by
-- `supabase_admin`, so `postgres` (SQL Editor / `db:apply`) gets
-- `42501: must be owner` on ALTER/POLICY, and REVOKE as `postgres`
-- silently no-ops. The authoritative prod fix must run as
-- `supabase_admin` via a Supabase support ticket (project
-- `open-spot-db-core`):
--
--   alter table public.spatial_ref_sys enable row level security;
--   drop policy if exists spatial_ref_sys_public_read on public.spatial_ref_sys;
--   create policy spatial_ref_sys_public_read
--     on public.spatial_ref_sys for select to public using (true);
--   revoke insert, update, delete, truncate, trigger
--     on table public.spatial_ref_sys from anon, authenticated;
--
-- This migration applies that same hardening wherever the apply role owns
-- the table (fresh/local DBs) and warns-and-skips where it does not
-- (managed prod), so `db:apply` never fails deploy on the ownership wall.
-- Idempotent: safe to re-run; no-ops once RLS + policy exist.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'spatial_ref_sys'
  ) THEN
    RAISE NOTICE '0039 skip: public.spatial_ref_sys does not exist (PostGIS not installed)';
    RETURN;
  END IF;

  BEGIN
    EXECUTE 'ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE '0039 skip: public.spatial_ref_sys is owned by supabase_admin — run the support-ticket SQL as supabase_admin (see file header)';
    RETURN;
  END;

  EXECUTE 'DROP POLICY IF EXISTS spatial_ref_sys_public_read ON public.spatial_ref_sys';
  EXECUTE 'CREATE POLICY spatial_ref_sys_public_read ON public.spatial_ref_sys FOR SELECT TO public USING (true)';

  BEGIN
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER ON TABLE public.spatial_ref_sys FROM anon, authenticated';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '0039 notice: REVOKE on public.spatial_ref_sys failed (%) — RLS policy above is the primary guard', SQLERRM;
  END;
END
$$;
