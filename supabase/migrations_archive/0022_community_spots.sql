-- Community autopopulation: personal → public promotion at >=2 distinct users within 300m
-- One radius (COMMUNITY_RADIUS_METERS=300) for both dedup suggestion and promotion.
-- Personal spots are only visible to their owner until promoted.
-- Ordering note: DDL (ADD COLUMN / ADD CONSTRAINT / CREATE INDEX) before DML
-- (UPDATE backfills) to avoid Postgres 55006 "pending trigger events" when a
-- file mixes UPDATE (fires bump_verification_count) + ALTER in one tx.
-- Applier now uses per-statement autocommit + session advisory lock, but
-- keeping DML last remains the safest ordering.

alter table public.spots add column if not exists visibility text not null default 'public';
--> statement-breakpoint
alter table public.spots add column if not exists origin text not null default 'seed';
--> statement-breakpoint
alter table public.spots add column if not exists community_submission_count integer not null default 0;
--> statement-breakpoint

-- Constraints — columns already have NOT NULL defaults, so no nulls to violate
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'spots_visibility_check') then
    alter table public.spots add constraint spots_visibility_check check (visibility in ('personal','public'));
  end if;
end $$;
--> statement-breakpoint
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'spots_origin_check') then
    alter table public.spots add constraint spots_origin_check check (origin in ('seed','community','user_personal'));
  end if;
end $$;
--> statement-breakpoint
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'spots_community_submission_count_check') then
    alter table public.spots add constraint spots_community_submission_count_check check (community_submission_count >= 0);
  end if;
end $$;
--> statement-breakpoint

create index if not exists spots_visibility_idx on public.spots(visibility);
--> statement-breakpoint
create index if not exists spots_origin_idx on public.spots(origin);
--> statement-breakpoint

-- Anonymous ledger for promotion counting
create table if not exists public.community_spot_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  canonical_spot_id uuid references public.spots(id) on delete set null,
  location geography(Point,4326) not null,
  submission_hash text not null,
  created_at timestamptz not null default now(),
  constraint community_submissions_user_hash_unique unique(user_id, submission_hash),
  constraint community_submissions_hash_check check (length(submission_hash) > 0)
);
--> statement-breakpoint
create index if not exists community_submissions_location_gist_idx on public.community_spot_submissions using gist(location);
--> statement-breakpoint
create index if not exists community_submissions_hash_idx on public.community_spot_submissions(submission_hash);
--> statement-breakpoint
create index if not exists community_submissions_canonical_idx on public.community_spot_submissions(canonical_spot_id);
--> statement-breakpoint

-- Backfills last (DML after all DDL) — idempotent, keeps pending triggers from blocking prior DDL
update public.spots set visibility = 'public' where visibility is null or visibility = '';
--> statement-breakpoint
update public.spots set origin = 'seed' where origin is null or origin = '';
--> statement-breakpoint
update public.spots set community_submission_count = 0 where community_submission_count is null;
--> statement-breakpoint
