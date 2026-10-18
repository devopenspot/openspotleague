-- Spot moderation hard-delete with historic preservation: detach games instead of destroying them.
-- `game_sessions` rows survive a spot delete with `spot_id` nulled, `spot_removed` set, and
-- name/city snapshots for display; unstarted lobbies are removed by the repository delete
-- transaction (their subtree cascades), and per-spot evidence scoped to the deleted spot
-- (`spot_weather_reports`, `game_location_verifications`) is removed there too.
-- `spot_challenge_records` keeps a name/slug snapshot as an audit trail of
-- which spot the record belonged to (no reader yet — per-spot history is
-- keyed by `spot_id`, and the spot is gone).
-- New inserts keep the strict invariant (`spot_removed` defaults to false); only the
-- moderation delete path sets it. DDL only — snapshots are written by the app delete
-- transaction, so there is no DML to order here.

alter table public.game_sessions add column if not exists spot_removed boolean not null default false;
--> statement-breakpoint
alter table public.game_sessions add column if not exists spot_name_snapshot text;
--> statement-breakpoint
alter table public.game_sessions add column if not exists spot_city_snapshot text;
--> statement-breakpoint
alter table public.spot_challenge_records add column if not exists spot_name_snapshot text;
--> statement-breakpoint
alter table public.spot_challenge_records add column if not exists spot_slug_snapshot text;
--> statement-breakpoint
alter table public.spot_challenge_records alter column spot_id drop not null;
--> statement-breakpoint

-- Swap the spot FKs from RESTRICT to SET NULL. The baseline used inline REFERENCES,
-- so Postgres auto-named the constraints; drop whatever FK currently guards the
-- column (unless it is already the new one) before adding the named replacement.
do $$ declare cname text; begin
  select c.conname into cname
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
   where c.conrelid = 'public.game_sessions'::regclass
     and c.contype = 'f'
     and a.attname = 'spot_id'
   limit 1;
  if cname is not null and cname <> 'game_sessions_spot_id_set_null_fk' then
    execute format('alter table public.game_sessions drop constraint %I', cname);
  end if;
end $$;
--> statement-breakpoint
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'game_sessions_spot_id_set_null_fk') then
    alter table public.game_sessions
      add constraint game_sessions_spot_id_set_null_fk
      foreign key (spot_id) references public.spots(id) on delete set null;
  end if;
end $$;
--> statement-breakpoint
do $$ declare cname text; begin
  select c.conname into cname
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
   where c.conrelid = 'public.spot_challenge_records'::regclass
     and c.contype = 'f'
     and a.attname = 'spot_id'
   limit 1;
  if cname is not null and cname <> 'spot_challenge_records_spot_id_set_null_fk' then
    execute format('alter table public.spot_challenge_records drop constraint %I', cname);
  end if;
end $$;
--> statement-breakpoint
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'spot_challenge_records_spot_id_set_null_fk') then
    alter table public.spot_challenge_records
      add constraint spot_challenge_records_spot_id_set_null_fk
      foreign key (spot_id) references public.spots(id) on delete set null;
  end if;
end $$;
--> statement-breakpoint

-- Challenge games keep requiring a spot, unless detached by moderation (`spot_removed`).
alter table public.game_sessions drop constraint if exists game_sessions_challenge_requires_spot_check;
--> statement-breakpoint
alter table public.game_sessions add constraint game_sessions_challenge_requires_spot_check
  check (
    mode <> 'challenge' or (
      (spot_id is not null and scheduled_start_at is not null and timezone is not null
        and location_radius_meters is not null and location_max_accuracy_meters is not null
        and location_verification_ttl_seconds is not null and created_by is not null)
      or (spot_id is null and spot_removed)
    )
  );
--> statement-breakpoint

-- Historic training weather stays readable after its spot is moderated away.
alter table public.game_sessions drop constraint if exists game_sessions_training_weather_check;
--> statement-breakpoint
alter table public.game_sessions add constraint game_sessions_training_weather_check
  check (
    (weather_confirmed is null and weather_forecast_icon is null
      and weather_observed_icon is null and weather_reported_at is null)
    or (weather_forecast_icon is not null and weather_confirmed is not null
      and weather_confirmed in (true, false)
      and (weather_confirmed = true or weather_observed_icon is not null)
      and ((spot_id is not null) or (spot_id is null and spot_removed)))
  );
--> statement-breakpoint
