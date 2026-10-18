-- Moderation hide for community autopopulation: admin can remove garbage from public view
-- without hard deletes. Per-spot and cluster (300m) hides are both supported.
-- `admin_hidden` is the anti-garbage flag: public directory must exclude it,
-- and promotion counting must exclude hidden canonicals.
-- DDL first, DML last (see 0022 rationale).

alter table public.spots add column if not exists admin_hidden boolean not null default false;
--> statement-breakpoint
create index if not exists spots_admin_hidden_idx on public.spots(admin_hidden);
--> statement-breakpoint
create index if not exists spots_admin_hidden_visibility_idx on public.spots(admin_hidden, visibility);
--> statement-breakpoint

-- Safety: if column existed with nulls (manual), backfill
update public.spots set admin_hidden = false where admin_hidden is null;
--> statement-breakpoint
