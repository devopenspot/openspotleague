# League (contests)

The League is OpenSpot's competition section. Users create **contests**, invite riders with a QR code or link, judge live runs, publish results, and earn league points. Contest curators can also create and moderate contests from admin.

It replaced the old **Sport Events** section in November 2026. The editorial event CRUD (`/admin/events`), the `origin` column and the `/sport-events/**` routes are gone. Old `/sport-events/*` URLs return 404, with no redirect. The table keeps its historical name, `sport_events`.

## Surfaces

| Surface | Route / file | What it does |
| --- | --- | --- |
| Nav | `src/lib/navigation/nav.ts` | `League` (`id="league"`, `ROUTES.league = "/league"`) in the header, bottom bar and drawer. |
| Landing | `/league` (`LeagueLanding`, public) | Hero with Join with code and Create a contest (signed-in only). Then **My contests** for signed-in users (Organizing / Judging / Riding, with payment notices). Then **Public contests**: status filter, featured hero, live & upcoming, past. |
| Create | `/league/new` (`LeagueCreateForm`, sign-in) | Essentials (name, short name, description, category, disciplines, optional cover), schedule, location, links. Calls `POST /api/league/events`, then the optional cover upload, then redirects to the console. |
| Contest page | `/league/[slug]` | Public contests: open to everyone. Unlisted (free) contests: **active members only**, `noindex`, everyone else gets 404. Shows the hero/cover, countdown, details, disciplines, links, My performance, and role CTAs (Manage contest, Judge queue). |
| Organizer console | `/league/[slug]/manage` (`ManageConsole`) | Tabs: Event (details, links, cover, listing, lifecycle), People (invites + QR, members), Runs, Metrics, Results. Payment gate actions. |
| Judge queue | `/league/[slug]/judge` (`JudgeQueue`) | For organizers and judges. Linked from the contest page. |
| Invite | `/league/join/[code]` (`JoinWithInvite`) | Invite preview. Guests sign in and come back (`sanitizeNext` allows `/league`). Signed-in users join and land on `/league/[slug]`. |
| Curation | `/admin/league/contests[/new\|/[id]]` | See [Contest curation](#contest-curation). |

Every contest path is built in `src/lib/league/urls.ts` (`buildContestDetailUrl`, `buildContestManageUrl`, `buildContestJudgeUrl`, `buildContestJoinUrl`, `buildContestMapUrl`, `CONTEST_NEW_PATH`). Never hand-write `/league/...` strings.

The wash (`bg-gradient-league`, via `LeagueWash`) covers the landing, contest page and join page. Create, console and judge stay on the monochrome surface (`DESIGN.md` `pages.league-landing` / `pages.league`).

## Public listing rule

- **Free-plan contests are private.** They are created `unlisted` and shared with riders by QR code or invite link. They never appear in the public directory, map, search or marquee.
- **Public listing is a paid-plan feature.** `visibility = 'public'` needs an active `paid` or `comped` payment on a non-free plan (`canListPublicly` / `assertVisibilityAllowed` in `src/lib/league/engine.ts`). Otherwise the API returns **403 `VISIBILITY_REQUIRES_PAID_PLAN`**, and the console hides the visibility select and explains why.
- Until paid tiers launch, the public list is empty. Its empty state says public listings arrive with the paid tiers.
- Every public read (`listContestDirectory`, `listEventsForMap`, the marquee, `findEventBySlug`) filters `visibility = 'public'`. The members-only path is `getContestDetailBySlug` in `src/lib/services/league/index.ts`.
- `featured` is curator-only. The landing hero is the featured public contest, or the next live or upcoming one if none is featured.

## Plans, quota and payment gate

Plans live in `src/data/event_plans.json`:

| Plan | Price | Contests / month | Riders | Judges | Organizers |
| --- | --- | --- | --- | --- | --- |
| `free` (default) | $0 | 8 | 3 | 0 (organizer judges) | 1 |
| `starter` | $5 | 21 | 13 | 2 | 2 |
| `pro` | $21 | 21 | 55 | 4 | 5 |

- **Quota.** `countContestsThisMonth` counts every contest the user created in the current UTC month. Going over returns `409 QUOTA_EXCEEDED`. Curator creates skip the quota.
- **Payment gate.** `paymentGate` in `src/lib/league/engine.ts` evaluates it lazily on every read and enforces it on every write. There is no cron.
  - `pending`: days 0–3. The contest is writable.
  - `locked`: days 3–6. The contest is read-only, and every write except payment returns `409 EVENT_LOCKED`.
  - `disabled`: day 6 and later. Every write returns `409 EVENT_DISABLED`.
  - `settled`: the contest has an active `paid` or `comped` payment. Registering the free plan ($0) settles it immediately. Curated contests get a `comped` row at creation.
- **Reminder emails.** `league_email_sweep()` (Supabase, payment reminders) selects contests with no active payment.

## Lifecycle

`draft → registration_open → registration_closed → scheduled → live → completed` (`EVENT_TRANSITIONS`). Any state before `completed` can go to `cancelled`.

- Joining by code needs `registration_open`.
- Registration can only open while the start date is in the future in UTC, so pick tomorrow or later.
- The schedule must start within 2 months.
- Publishing results freezes `event_results` and writes `event_points_ledger` plus `rider_stats` (10 points for attendance, then 100/80/60/50/40 for the top five, with a floor of 25). Those points feed the global ranking and profile totals.

## Covers and links

- **Links.** `url`, `instagram` and `youtube` are http(s) URLs. Organizers set them in the create form and the console's Event tab, and curators can edit them. They render on cards, the featured hero and the contest page.
- **Covers.** `POST /api/league/events/[id]/cover` (multipart `image`, `expectedVersion`, `idempotencyKey`) and `DELETE` (JSON) are organizer routes. `/api/admin/league/contests/[id]/cover` is the curator route. Both use `src/app/api/league/cover-handlers.ts`:
  - The caller is authorized before the upload, so a rejected caller never writes to storage.
  - The file goes to the R2 events bucket through `uploadEventImage`.
  - `setContestCover` then swaps `image_url` in a versioned, idempotent transaction.
  - Replaced, replayed and failed uploads are removed best-effort.
  - `sharp` doesn't load in `workerd`, so the original file is stored as-is.
- **Fallback cover.** With no cover, `image_url` holds `DEFAULT_CONTEST_IMAGE` (`src/lib/league/cover.ts`) and the UI renders `ContestCover`, the designed fallback, instead of a photo.
- **Create flow.** The create form uploads the cover after the 201. If that upload fails, it opens the console with `?cover=failed`, and the console shows a notice offering the upload again.

## Contest curation

The `contest_curator` role (formerly `event_curator`) carries `content.read`, `media.manage` and **`league.curate`**, and is scoped by country through `curator_country_scopes`. Admins hold `league.curate` too. The legacy `curator` role does not, so it has no contest curation.

| Action | Route | Notes |
| --- | --- | --- |
| List | `GET /api/admin/league/contests` and the `/admin/league/contests` page | All plans, listings and statuses in the caller's scope. Admins see every country. |
| Create | `POST /api/admin/league/contests` and `/admin/league/contests/new` (create form in curator mode) | The curator becomes main organizer, picks the plan (written as `comped`, so the gate is settled), may list publicly (paid plans only) and feature. No quota. |
| Inspect | `GET /api/admin/league/contests/[id]` and `/admin/league/contests/[id]` | Full `LeagueEventState` without membership (`getContestForCuration`). |
| Edit | `PATCH …/[id]` | Name, copy, links and `featured` can change any time before the contest ends. Schedule and location can only change before it goes live. |
| Hide / list | `POST …/[id]/visibility` | Hiding always works. Listing follows the public listing rule. |
| Cancel | `POST …/[id]/cancel` | Same transition and member notifications as an organizer cancel. |
| Cover | `POST` / `DELETE …/[id]/cover` | Needs `media.manage`. |

- **Scope checks.** `authorizeCuratorForContest` checks the contest's country, and `authorizeCuratorForCountry` checks the create country or the target country when a contest moves. Both live in `src/app/api/admin/league/contests/curator-auth.ts`.
- **Shared write path.** The writers take `{ asCurator: true, reason }` and run the same write path as organizers: lock, OCC, idempotency, signal, notifications, tags. Membership and payment-gate checks are skipped.
- **Moderation note.** The optional note is stored in `event_action_requests.response_metadata` as `{ curator: true, reason }`.

## Write path

`src/lib/services/league/index.ts` is the only writer. Every mutation runs:

1. `withDbWrite` + `db.transaction`
2. `lockEvent` (`SELECT … FOR UPDATE`)
3. the `expectedVersion` OCC check (`STALE_VERSION`)
4. a capability check (`assertCapability`), unless `asCurator`
5. the gate check (`assertEventWritable`), unless `asCurator`
6. the fingerprint idempotency check (`event_action_requests`, `IDEMPOTENCY_CONFLICT`)
7. a version bump
8. the realtime signal row (`event_realtime_signals`)
9. in-transaction notifications
10. `queueEventTags` for post-commit invalidation

Mutations return `{ id, version }`, and create returns `{ id, version, slug }`.

## Error taxonomy (`src/app/api/league/errors.ts`)

| Status | Codes |
| --- | --- |
| 400 | `INVALID_INPUT`, `SCORE_INVALID`, `SCHEDULE_TOO_FAR_AHEAD` |
| 403 | `NOT_AUTHORIZED`, `VISIBILITY_REQUIRES_PAID_PLAN` |
| 404 | `PAYMENT_NOT_FOUND`, `PLAN_NOT_FOUND`, `USER_NOT_FOUND` |
| 409 | `STALE_VERSION`, `INVALID_TRANSITION`, `CAPACITY_EXCEEDED`, `QUOTA_EXCEEDED`, `ALREADY_MEMBER`, `INVITE_INVALID`, `INVITE_EXHAUSTED`, `PAYMENT_EXISTS`, `RUN_WINDOW_CLOSED`, `NOT_SCORED`, `EMPTY_SCHEDULE`, `EVENT_LOCKED`, `EVENT_DISABLED`, `IDEMPOTENCY_CONFLICT`, `PLAN_EXISTS` |
| 429 | `RATE_LIMITED` |
| 503 | `TimeoutError` / connection errors |

## Data model

- **`sport_events`** is one row per contest. Its notable columns:
  - `visibility`
  - `status`
  - `plan_slug`
  - `featured`
  - `image_url`
  - `url`, `instagram`, `youtube`
  - `version` (the OCC counter)
  - `payment_due_at` and `payment_deadline_at`
  - `created_by`

  RLS policy `sport_events_public_read`: rows are readable when `visibility = 'public'`, or by their creator.
- **Child tables.** These hang off `sport_events.id` and cascade on delete:
  - `event_disciplines`
  - `event_memberships`
  - `event_invites`
  - `event_scoring_criteria`
  - `event_runs`
  - `event_scores`
  - `event_results`
  - `event_points_ledger`
  - `event_payments`
  - `event_action_requests`
  - `event_realtime_signals`
  - `league_email_log`
- **Migrations.**
  - `0005_contests_drop_origin` drops `origin`, re-keys the quota index to `(created_by, created_at)`, unlists public contests without a paid plan, and redefines the email sweep.
  - `0006_contest_curator_role` renames `event_curator` to `contest_curator` and adds `league.curate`.

## Testing notes

- **Sign-in.** Login is Google OAuth only. Browser E2E needs an injected Supabase session cookie.
- **Create-and-join scripts** must do these in order:
  1. Pick a start date of tomorrow or later in UTC.
  2. Open registration before riders join.
  3. Expect `/league/[slug]` to render only for members while the contest is free (unlisted).
