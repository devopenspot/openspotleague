# League (contests)

The League is OpenSpot's competition section. Users create **contests** with one or more **divisions** (discipline × format), invite riders with a QR code or link, judge runs live or from submitted videos on the five World Skate criteria, publish results, and earn league points. Contest curators can also create and moderate contests from admin.

It replaced the old **Sport Events** section in November 2026. The editorial event CRUD (`/admin/events`), the `origin` column and the `/sport-events/**` routes are gone. Old `/sport-events/*` URLs return 404, with no redirect. The table keeps its historical name, `sport_events`.

## Surfaces

| Surface | Route / file | What it does |
| --- | --- | --- |
| Nav | `src/lib/navigation/nav.ts` | `League` (`id="league"`, `ROUTES.league = "/league"`) in the header, bottom bar and drawer. |
| Landing | `/league` (`LeagueLanding`, public) | Hero with Join with code and Create a contest (signed-in only). Then **My contests** for signed-in users (Organizing / Judging / Riding, with payment notices). Then **Public contests**: status filter, featured hero, live & upcoming, past. |
| Create | `/league/new` (`LeagueCreateForm`, sign-in) | Essentials (name, short name, description, category, optional cover), **Format** (Live or Video, video deadline, divisions as discipline × format chips), schedule, location, links. Calls `POST /api/league/events`, then the optional cover upload, then opens the hub's Run the contest tab. |
| Contest page + hub | `/league/[slug]` | Public contests: open to everyone. Unlisted (free) contests: **active members only**, `noindex`, everyone else gets 404. The hero, details and links are server-rendered. Members get the **contest hub** below it (`src/components/league/hub/ContestHub.tsx`, see [Contest hub](#contest-hub)); visitors of a public contest see the final standings once published. |
| Old console / judge URLs | `/league/[slug]/manage`, `/league/[slug]/judge` | Redirect to `?tab=run#hub` and `?tab=judging#hub`. |
| Result card | `/league/[slug]/r/[userId]` (+ `opengraph-image`; the contest page has its own `/league/[slug]/opengraph-image`) | A rider's published results with share and download. Same visibility as the standings. |
| Ranking | `/league/ranking` (sign-in) | Top 50 by league points, filter by discipline, format and country, plus the viewer's position. |
| Invite | `/league/join/[code]` (`JoinWithInvite`) | Invite preview. Guests sign in and come back (`sanitizeNext` allows `/league`). Signed-in users join and land on `/league/[slug]`. |
| Curation | `/admin/league/contests[/new\|/[id]]` | See [Contest curation](#contest-curation). |
| Plans and payments (admin) | `/admin/league/plans`, `/admin/league/account-plans`, `/admin/league/payments` | Edit plan limits and prices, account plans, and review contest payments (`/api/admin/league/{plans,plans/[slug],account-plans,payments,payments/[id]}`). |
| Errors | `src/app/league/error.tsx` | One `CARD` on the surface (no wash). |

Every contest path is built in `src/lib/league/urls.ts` (`buildContestDetailUrl`, `buildContestHubUrl`, `buildContestManageUrl`, `buildContestJudgeUrl`, `buildContestResultUrl`, `buildContestJoinUrl`, `buildContestMapUrl`, `CONTEST_NEW_PATH`, `LEAGUE_RANKING_PATH`). Never hand-write `/league/...` strings.

The wash (`bg-gradient-league`, via `LeagueWash`) covers `/league`, `/league/[slug]` (the hub sits in a surface panel on it), `/league/[slug]/r/[userId]` and `/league/join/[code]`. Create, ranking and the error page stay on the monochrome surface (`DESIGN.md` `pages.league-landing` / `pages.league`).

## Contest hub

One client component per contest (`ContestHub`) for every member role. `useContestState` makes one shared `GET /api/league/events/[id]`, refreshes it on the realtime signal channel, and sends versioned mutations. Some tabs add their own reads: Standings fetches `/standings`, and the Run the contest console fetches `/members`, `/dashboard` and `/payment`.

The hub's actions live under `/api/league/events/[id]/*`: `registration/{open,close}`, `schedule`, `start`, `complete`, `results/publish`, `cancel`, `invites[/[inviteId]]`, `members[/[membershipId]]`, `entry`, `leave`, `runs/[runId]/{window,scores,video}`, `cover`, `payment`, `dashboard`, `standings` (`history` has no caller yet). Joining uses `POST /api/league/join` and the invite preview `GET /api/league/invites/[code]`.

- **Your next step.** One card with one primary action, from `nextStepFor` (`src/lib/league/next-step.ts`, tested) fed by `buildNextStepInput` (`src/lib/league/hub-state.ts`). Examples: "Invite riders", "Submit your Roller · Park video", "3 runs waiting for your score", "Publish the results".
- **Tabs** (`hubTabsFor`, deep-link with `?tab=`):

| Tab | Who | What |
| --- | --- | --- |
| Overview | everyone | `FormatBrief`: how runs are scored, each division's run length, required elements, judge guidance per criterion and example tricks. |
| Standings | everyone | `StandingsBoard`: per-division ranks, Junior/Senior and city, "You" tag, Provisional/Final badge, Street best-trick board. |
| My runs | riders | Entry (divisions, Junior/Senior, gender, city), one card per run: element checklist, live start time or the video form with deadline, readable status, provisional score, then rank, points, element completion and **Share my result**. Leave contest while registration is open. |
| Judging | judges, organizers | `JudgingPanel`: To score / Waiting / Scored by you queues and the scoring card (`RatedScoreForm`, legacy `RunScoreForm` for `open` divisions). Organizers run live windows here (open next, +5 min, close). |
| Run the contest | organizers | `LifecycleStepper` plus `ManageConsole`: Contest (details, format, links, cover, listing, lifecycle actions), People (invites + QR, members), Runs (read-only overview), Metrics. Payment gate actions. |

## Divisions and submission modes

- **Divisions** (`event_divisions`) are discipline × format: `park`, `street`, `vert`, or `open` for contests created before 0007 (they keep their stored 4-criteria scoring). Riders enter divisions (`event_division_entries`); each division has its own runs, results and standings. Plan caps still count riders per contest. Divisions and the mode can change only before runs are prepared (`SETUP_STATUSES`).
- **Live** contests: "Generate schedule" creates one slot per rider and division (division order, then join order); organizers open each judging window.
- **Video** contests: "Prepare runs" creates one run per rider and division without times. While the contest is `live` and before `submission_deadline_at`, the rider submits a link (`POST …/runs/[runId]/video`; YouTube, Instagram, Vimeo or Google Drive, https only, `src/lib/league/rating/video-links.ts`). Street also needs the best-trick link. The link can be replaced until a judge scores the run. Judges score any submitted run while the contest is live. Completing after the deadline skips runs that never got a video.
- **Rider entry**: `joinEventByCode` takes `entry` (divisions, `ageCategory` `junior|senior` from Article 3 of Res. 082/2026, optional gender and city); `PATCH …/entry` changes it while registration is open. Category, gender and city are labels in standings, not ranking splits.

## Rating (Article 9)

The engine is pure and lives in `src/lib/league/rating/`. It follows Article 9 ("Metodología de Selectivo Técnico") of Resolución 082/2026 of the Federación Colombiana de Patinaje, extended to every discipline.

| Format | Run | Best trick |
| --- | --- | --- |
| Park (bowl) | 50 s | — |
| Street | 50 s | yes, scored separately |
| Vert | 45 s | — |

- **Criteria** (`criteria.ts`): difficulty, style, amplitude, consistency, creativity — equal weight, with per-format judge guidance condensed from the article.
- **Scale** (`scoring.ts`): each criterion 0–10 in 0.5 steps; a judge's run total is the mean × 10 (0–100). Every criterion is required.
- **Panel**: with 4 or more judges the highest and lowest totals are dropped (trimmed mean); otherwise the plain mean.
- **Best trick** (Street): difficulty + execution on the same scale and panel rule. It breaks ties and has its own board.
- **Ranking** (`rankDivision`, `contest-ranking.ts`): panel score → best trick → mean difficulty → best single judge total → earlier order. Ranks are distinct.
- **Required elements** (`elements.ts`): a judge checklist per discipline × format. An element counts as shown when a strict majority of the panel ticked it. It never changes the score.
- **Review gate.** Roller lists come from Article 9 (`reviewed: true`). Skateboard, BMX and Scooter lists are drafts adapted from the same structure (`reviewed: false`, `REVIEW_PENDING`, flagged in the UI as drafts) and need owner sign-off.
- **Visibility before publishing** (`src/lib/league/visibility.ts`): organizers and curators see every judge's scores; a judge sees only their own; riders see panel totals only. After publishing, members see the full breakdown. Riders see only their own video links.

## Leaderboards

- **Contest standings**: `GET /api/league/events/[id]/standings` → `getContestStandings` (`src/lib/services/league/standings.ts`). Provisional (members only, panel totals, uncached) until results are published; then the frozen `event_results`, public and `"use cache: remote"` for public contests, members-only for unlisted ones.
- **Global ranking**: `GET /api/league/ranking` and `/league/ranking` → `listLeagueRanking`, summing `event_points_ledger`. Discipline and format filters count division rank bonuses; the country filter applies to every row. Cached remote under `ranking:global`.

## Public listing rule

- **Free-plan contests are private.** They are created `unlisted` and shared with riders by QR code or invite link. They never appear in the public directory, map, search or marquee.
- **Public listing is a paid-plan feature.** `visibility = 'public'` needs an active `paid` or `comped` payment on a non-free plan (`canListPublicly` / `assertVisibilityAllowed` in `src/lib/league/engine.ts`). Otherwise the API returns **403 `VISIBILITY_REQUIRES_PAID_PLAN`**, and the console hides the visibility select and explains why.
- Until paid tiers launch, the public list is empty. Its empty state says public listings arrive with the paid tiers.
- Every public read (`listContestDirectory`, `listEventsForMap`, the marquee, `findEventBySlug`) filters `visibility = 'public'`. The members-only path is `getContestDetailBySlug` in `src/lib/services/league/index.ts`.
- `featured` is curator-only. The landing hero is the featured public contest, or the next live or upcoming one if none is featured.

## Plans, quota and payment gate

Plans are seeded from `src/data/event_plans.json` (through `src/db/seed-data/taxonomy.ts`) and admins edit them at `/admin/league/plans`. The seeded values:

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
- Publishing results ranks each division, freezes `event_results` and writes `event_points_ledger` plus `rider_stats`: 10 points for attendance **once per contest**, then a rank bonus **per division** (100/80/60/50/40 for the top five, floor 25). A contest counts once as won when the rider wins any division. Ledger rows carry `division_id`, `discipline_slug`, `format` and `country_code` for the ranking filters. Points feed the global ranking, the profile totals, the activity grid and the profile League card; publishing invalidates the rider's profile cache.

## Covers and links

- **Links.** `url`, `instagram` and `youtube` are http(s) URLs. Organizers set them in the create form and the console's Contest tab, and curators can edit them. They render on cards, the featured hero and the contest page.
- **Covers.** `POST /api/league/events/[id]/cover` (multipart `image`, `expectedVersion`, `idempotencyKey`) and `DELETE` (JSON) are organizer routes. `/api/admin/league/contests/[id]/cover` is the curator route. Both use `src/app/api/league/cover-handlers.ts`:
  - The caller is authorized before the upload, so a rejected caller never writes to storage.
  - The file goes to the R2 events bucket through `uploadEventImage`.
  - `setContestCover` then swaps `image_url` in a versioned, idempotent transaction.
  - Replaced, replayed and failed uploads are removed best-effort.
  - `sharp` doesn't load in `workerd`, so the original file is stored as-is.
- **Fallback cover.** With no cover, `image_url` holds `DEFAULT_CONTEST_IMAGE` (`src/lib/league/cover.ts`) and the UI renders `ContestCover`, the designed fallback, instead of a photo.
- **Create flow.** The create form uploads the cover after the 201. If that upload fails, it opens the hub's Run the contest tab with `?cover=failed`, and the console shows a notice offering the upload again.

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
| 409 | `STALE_VERSION`, `INVALID_TRANSITION` (also: divisions fixed once runs exist, video locked once judged), `CAPACITY_EXCEEDED`, `QUOTA_EXCEEDED`, `ALREADY_MEMBER`, `INVITE_INVALID`, `INVITE_EXHAUSTED`, `PAYMENT_EXISTS`, `RUN_WINDOW_CLOSED`, `NOT_SCORED`, `EMPTY_SCHEDULE`, `EVENT_LOCKED`, `EVENT_DISABLED`, `IDEMPOTENCY_CONFLICT`, `PLAN_EXISTS` |
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
  Also `submission_mode` (`live|video`) and `submission_deadline_at` (required for video).
- **Child tables.** These hang off `sport_events.id` and cascade on delete:
  - `event_disciplines`
  - `event_divisions` and `event_division_entries`
  - `event_memberships` (rider `age_category`, `gender`, `rider_city`)
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
  - `0007_league_divisions_rating` adds divisions and entries, the submission mode, rider entry fields, video links and the `submitted` run status, best trick and element ticks on scores, per-division results and the ledger's ranking dimensions. It backfills one `open` division per existing discipline (a contest without disciplines gets `roller`); the first owns the existing runs, results, criteria and rider entries.
- **Run statuses**: `scheduled → judging → scored | skipped` (live) and `scheduled → submitted → scored | skipped` (video).

## Testing notes

- **Sign-in.** Login is Google OAuth only. Browser E2E needs an injected Supabase session cookie.
- **Create-and-join scripts** must do these in order:
  1. Pick a start date of tomorrow or later in UTC.
  2. Open registration before riders join.
  3. Expect `/league/[slug]` to render only for members while the contest is free (unlisted).
- **Video contests** need a deadline after the start date; submissions open only once the contest is `live`.
