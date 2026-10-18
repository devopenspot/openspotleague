# League data model spec

Source requirements: `.agents/specs/league/plan.league.spec.md`.
Locked decisions: unified `sport_events` (editorial + league), payments modeled with manual admin activation, account-level monthly quota, organizer judges implicitly, full phased delivery.

Scope of this doc: database schema, migration strategy, seeds. Engine semantics live in `engine.spec.md`, HTTP contracts in `api.spec.md`, surfaces in `ui.spec.md`, quality gates in `verification.spec.md`.

## Conventions

- All tables in `public`; `uuid` PKs `default gen_random_uuid()` unless noted; `timestamptz` UTC; enum-like text columns via `CHECK`; every FK that is queried gets an index; RLS enabled with public/member select policies (app writes go through the privileged pooler and bypass RLS).
- Migration is **drop-and-recreate**: existing `sport_events`, `event_disciplines`, `event_tiers` rows are disposable. Applied migration files are immutable; the new file supersedes baseline data on fresh DBs (`db:fresh` replays baseline inserts, then this migration drops them).
- `content_audit_log` keeps `entityType='event'` for admin content CRUD. League engine actions are audited by the tables themselves (memberships status, runs, scores, results, payments); no extra audit log in v1.

## Migration files

- `supabase/migrations/0026_events_league_redesign.sql` — drop-and-recreate of the events section (see drop list below).
- `supabase/migrations/0027_league_payment_gate.sql` — adds `sport_events.payment_due_at` / `payment_deadline_at` + a deadline index (payment gate; set at creation by the league service for community events, null for editorial).
- `supabase/migrations/0028_user_notifications.sql` — adds the `user_notifications` table (see Notifications below) + realtime publication entry for the per-user channel.
- `supabase/migrations/0032_email_sweep_hardening.sql` — Phase-5 sweep hardening (replaces the 0030 function body): HTML-escaping of user-controlled strings, one payment reminder per event per run (highest applicable day only — no catch-up burst), per-user advisory lock + post-enqueue digest watermark, stale-row catch-up watermark (see `email.spec.md`).
- `supabase/migrations/0033_league_hardening_indexes.sql` — hardening indexes (`event_memberships(joined_via_invite_id)`, `sport_events(created_by, origin, created_at)` for the quota hot path) and drops the `emit_event_realtime_signal` trigger/function: the service is the single realtime signal writer.

Drop list in dependency order:

1. RLS policies on the three event tables, `enforce_event_discipline_presence()` function, the two deferred-constraint triggers (`sport_events_require_discipline`, `event_disciplines_require_parent_discipline`).
2. Tables: `event_disciplines` → `sport_events` → `event_tiers` (trgm indexes die with the table).
3. Recreate everything below, then re-add RLS, the realtime trigger/publication, and seed `event_categories` + `event_plans` defaults.

## Core tables

```
event_categories                          -- rename of event_tiers (frees "tier" for billing plans)
  slug        text PK
  name        text not null, length > 0
  sort_order  int not null default 0, >= 0
  index (sort_order)

sport_events
  id          uuid PK default gen_random_uuid()
  slug        text not null unique
  name        text not null, length > 0
  short_name  text
  description text not null default ''
  origin      text not null default 'community'   check in ('seed','community')
  visibility  text not null default 'unlisted'    check in ('public','unlisted')
              -- community events default unlisted; admin content create passes 'public'
  status      text not null default 'draft'
              check in ('draft','registration_open','registration_closed','scheduled','live','completed','cancelled')
  timezone    text not null                       -- IANA name, validated app-side; admin path defaults 'UTC'
  start_at    timestamptz not null
  end_at      timestamptz                         check end_at is null or end_at >= start_at
  registration_closes_at / schedule_published_at / started_at /
  completed_at / cancelled_at / results_published_at   timestamptz, lifecycle audit
  payment_due_at / payment_deadline_at  timestamptz   -- payment gate (0027): created_at + 3d / + 6d, community events only; null for editorial
  city        text not null, length > 0
  city_slug   text
  address     text
  country_code text not null FK countries(iso2) on delete restrict
  venue       text
  location    geography(Point,4326)               -- nullable; gist index when present
  spot_id     uuid FK spots(id) on delete set null
  spot_name_snapshot / spot_city_snapshot text   -- survive spot hard-delete (display only)
  category_slug text FK event_categories(slug) on delete restrict
  plan_slug     text not null default 'free' FK event_plans(slug) on delete restrict
  featured    boolean not null default false
  image_url   text not null, length > 0           -- league create makes imageUrl optional; the service fills DEFAULT_EVENT_IMAGE
  url         text                                -- nullable for league events
  instagram / youtube text
  version     int not null default 0, >= 0        -- OCC counter, bumped by every lifecycle/content mutation
  created_by / updated_by uuid FK auth.users(id) on delete set null
  created_at / updated_at timestamptz not null default now()
  indexes: unique(slug), (country_code), (category_slug), (plan_slug), (start_at, id),
           (country_code, start_at), (city_slug), gist(location), (origin), (visibility),
           (status), (featured); trgm(name), trgm(city)

event_disciplines
  event_id       uuid not null FK sport_events(id) on delete cascade
  discipline_slug text not null FK sport_disciplines(slug) on delete restrict
  PK (event_id, discipline_slug); indexes (discipline_slug), (discipline_slug, event_id)
```

## Competition tables

```
event_memberships
  id        uuid PK
  event_id  uuid not null FK sport_events(id) on delete cascade
  user_id   uuid not null FK auth.users(id) on delete cascade
  role      text not null check in ('main_organizer','organizer','judge','rider')
  status    text not null default 'active' check in ('active','removed','withdrawn')
  joined_via_invite_id uuid FK event_invites(id) on delete set null
  added_by  uuid FK auth.users(id) on delete set null
  joined_at timestamptz not null default now()
  removed_at timestamptz; removed_by uuid FK auth.users(id) on delete set null
  UNIQUE partial (event_id, user_id) WHERE status = 'active'                  -- one active role per user per event
  UNIQUE partial (event_id) WHERE role = 'main_organizer' AND status = 'active'
  indexes (user_id, status), (event_id, role, status)

event_invites
  id        uuid PK
  event_id  uuid not null FK sport_events(id) on delete cascade
  role      text not null check in ('organizer','judge','rider')   -- main organizer is never invitable
  code      text not null unique                                   -- short base62, app-generated
  created_by uuid FK auth.users(id) on delete set null
  expires_at timestamptz
  max_uses  int check max_uses is null or max_uses > 0
  use_count int not null default 0, >= 0
  check use_count <= max_uses or max_uses is null
  revoked_at timestamptz; created_at timestamptz not null default now()
  index (event_id, role)

event_scoring_criteria
  id        uuid PK
  event_id  uuid not null FK sport_events(id) on delete cascade
  key       text not null (lowercase slug)      -- defaults: style, consistency, amplitude, technique
  label     text not null, length > 0
  weight    numeric(6,3) not null default 1, > 0
  max_score numeric(6,2) not null, > 0
  sort_order int not null default 0, >= 0
  UNIQUE (event_id, key)

event_runs
  id            uuid PK
  event_id      uuid not null FK sport_events(id) on delete cascade
  membership_id uuid not null FK event_memberships(id) on delete cascade
  user_id       uuid not null FK auth.users(id) on delete cascade   -- denormalized rider
  stage         text not null default 'final'
  sequence      int not null, > 0
  status        text not null default 'scheduled'
                check in ('scheduled','judging','scored','skipped','completed')
  scheduled_at / window_started_at / window_ends_at timestamptz
  created_at / updated_at timestamptz not null default now()
  UNIQUE (event_id, membership_id, stage)
  UNIQUE (event_id, stage, sequence)
  check window_ends_at is null or (window_started_at is not null and window_ends_at > window_started_at)
  index (event_id, status)

event_scores
  id            uuid PK
  event_id      uuid not null FK sport_events(id) on delete cascade    -- denormalized for authz/queries
  run_id        uuid not null FK event_runs(id) on delete cascade
  judge_user_id uuid not null FK auth.users(id) on delete cascade
  scores        jsonb not null check jsonb_typeof(scores) = 'object'   -- { criterionKey: number }
  total         numeric(8,2) not null, >= 0                            -- weighted judge total
  submitted_at  timestamptz not null default now()
  updated_at    timestamptz not null default now()
  UNIQUE (run_id, judge_user_id); index (event_id)

event_results                                     -- frozen on publish
  id            uuid PK
  event_id      uuid not null FK sport_events(id) on delete cascade
  user_id       uuid not null FK auth.users(id) on delete cascade
  run_id        uuid FK event_runs(id) on delete set null
  total_score   numeric(8,2) not null, >= 0
  rank          int not null, > 0
  points_awarded int not null, >= 0
  published_at  timestamptz not null default now()
  UNIQUE (event_id, user_id); UNIQUE (event_id, rank)

event_points_ledger                               -- mirrors rider_score_events pattern
  id         uuid PK
  event_id   uuid not null FK sport_events(id) on delete cascade
  user_id    uuid not null FK auth.users(id) on delete cascade
  event_key  text not null unique                  -- event:<eventId>:rider:<userId>:attended|rank
  event_type text not null check in ('event_attended','event_rank_bonus')
  points     int not null, >= 0
  rank       int
  created_at timestamptz not null default now()
  indexes (user_id, created_at), (event_id)

rider_stats (ALTER)  +  events_attended int not null default 0 >= 0,
                     events_won int not null default 0 >= 0
```

## Billing / quota tables

```
event_plans                                        -- system-admin configurable
  slug        text PK                              -- seeded: free, starter, pro
  name        text not null, length > 0
  description text not null default ''
  price_cents int not null, >= 0
  currency    text not null default 'USD'
  max_riders  int not null, > 0
  max_judges  int not null, >= 0
  max_organizers int not null, >= 1
  monthly_event_limit int not null, > 0
  is_default  boolean not null default false
  active      boolean not null default true
  sort_order  int not null default 0, >= 0
  created_by / updated_by uuid FK auth.users(id) on delete set null
  created_at / updated_at timestamptz not null default now()
  UNIQUE partial WHERE is_default AND active                  -- exactly one default plan

user_event_plans                                   -- account-level entitlement; absent row = free
  user_id   uuid PK FK auth.users(id) on delete cascade
  plan_slug text not null FK event_plans(slug) on delete restrict
  source    text not null check in ('payment','admin_grant')
  status    text not null default 'active' check in ('active','revoked')
  granted_by uuid FK auth.users(id) on delete set null
  granted_at timestamptz not null default now()
  updated_at timestamptz not null default now()
  index (plan_slug)

event_payments
  id          uuid PK
  event_id    uuid not null FK sport_events(id) on delete cascade
  plan_slug   text not null FK event_plans(slug) on delete restrict
  status      text not null default 'pending' check in ('pending','paid','refunded','comped','failed')
  amount_cents int not null, >= 0
  currency    text not null
  provider    text not null default 'manual'
  provider_reference text
  payer_user_id / marked_paid_by / created_by uuid FK auth.users(id) on delete set null
  paid_at / refunded_at timestamptz
  created_at / updated_at timestamptz not null default now()
  UNIQUE partial (event_id) WHERE status IN ('pending','paid','comped')
```

## Engine plumbing

```
event_action_requests                              -- idempotency ledger, mirrors game_action_requests
  id                 uuid PK
  event_id           uuid not null FK sport_events(id) on delete cascade
  user_id            uuid not null FK auth.users(id) on delete cascade
  action             text not null
  idempotency_key    text not null
  request_fingerprint text not null
  resulting_version  int not null, >= 0
  response_metadata  jsonb not null default '{}'
  created_at         timestamptz not null default now()
  UNIQUE (event_id, user_id, action, idempotency_key)
  indexes (created_at), (user_id, action, idempotency_key), (event_id, action, created_at)

event_realtime_signals                             -- mirrors game_realtime_signals
  id          bigint generated always as identity PK
  event_id    uuid not null FK sport_events(id) on delete cascade
  version     int not null, >= 0
  signal_type text not null check in
    ('event_state_changed','registration_changed','schedule_published',
     'run_started','score_submitted','results_published','event_cancelled')
  created_at  timestamptz not null default now()
  UNIQUE (event_id, version); index (event_id, created_at)
```

- The service writes signals explicitly (single writer — covers version-zero creation and non-event-row state). The `emit_event_realtime_signal()` DB trigger existed initially but was removed in 0033: its generic row always lost `ON CONFLICT DO NOTHING` to the typed service row written at the same `(event_id, version)`, and editorial/admin content edits no longer emit a generic signal (consoles recover via STALE_VERSION refetch).
- `event_realtime_signals` added to the `supabase_realtime` publication (idempotent drop/add guards, mirroring the games block).
- RLS select policy on signals: creator or active member via `is_event_participant(event_id)` SQL helper.

## Notifications (in-app v1)

```
user_notifications
  id         uuid PK default gen_random_uuid()
  user_id    uuid not null FK auth.users(id) on delete cascade
  type       text not null                    -- app-defined constants (definitions.ts), no CHECK (extensible)
  payload    jsonb not null default '{}'      -- { eventId, eventSlug, eventName, role, points, rank, ... }
  event_id   uuid FK sport_events(id) on delete set null   -- nullable: admin/system notifications
  read_at    timestamptz                      -- null = unread
  created_at timestamptz not null default now()
  indexes (user_id, created_at desc), (user_id) WHERE read_at is null, (event_id)
```

- Written **inside the same transaction** as the league mutation that triggers them (no queue — see plan decisions). Recipients are resolved from `event_memberships` (active, role-filtered) and, for admin alerts, from users holding `league.manage` (permission join). Fan-out is capped by the event's member count (≤ pro caps).
- Realtime: insert-trigger broadcast on channel `user:<uid>` added to the `supabase_realtime` publication (same pattern as `event_realtime_signals`); clients also poll on focus as fallback.
- Delivery note: gate-state reminder emails / push rows are Phase 5 (Resend + pg_cron sweep); v1 notification types cover league actions only (invite sent/revoked, registration confirmed, member removed, schedule published, event started/cancelled, results published, points earned, payment registered, admin pending-payment alert).

## RLS summary

- `sport_events`: public select where `visibility='public'`; creator/member select otherwise; writes via service role only.
- `event_memberships`, `event_runs`, `event_scores`, `event_results`, `event_points_ledger`: member visibility (own rows + co-members of the same event).
- `event_invites`, `event_plans`, `user_event_plans`, `event_payments`, `event_action_requests`: service role only (organizer reads flow through the app API).
- `user_notifications`: owner select/update (`user_id = auth.uid()`) — read, mark read; writes via service role (in-transaction fan-out).

## Seeds

- `event_categories`: world-tour, championship, festival, federation, local-event (same slugs as legacy tiers).
- `event_plans`:
  - `free`: 0¢, max_riders 3, max_judges 0, max_organizers 1, monthly limit 8, is_default.
  - `starter`: 500¢, max_riders 13, max_judges 2, max_organizers 2, monthly limit 21.
  - `pro`: 2100¢, max_riders 55, max_judges 4, max_organizers 5, monthly limit 21.
  Values are admin-editable at runtime; seed is the bootstrap.
- Editorial events re-seeded with `origin='seed'`, `visibility='public'`, lifecycle status derived from dates at seed time, `plan_slug='free'`, `timezone='UTC'`.

## Downstream updates in the same phase

- `src/db/schema/index.ts` rewrite of the event section (+ relations + row types), `src/db/schema/spots.ts` barrel re-exports.
- `src/db/reset.ts` drop order; baseline verifier scripts; baseline generator pinned to the immutable baseline (not regenerated for the new shape).
- Storage GC / R2 scripts read only `sport_events.image_url` — unchanged.
- `detachSpotDependents` (`src/lib/repositories/spot/spot-delete-plan.ts`) extended to snapshot `sport_events.spot_name_snapshot`/`spot_city_snapshot` when a spot is purged (FK is `set null`, no RESTRICT, so deletes never fail).
