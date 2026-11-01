Locked decisions (2026-09-13):

- Unified `sport_events` entity: editorial/seed events and user-created league events in one table, separated by `origin`/`visibility`. Existing rows are disposable — the section was redesigned from scratch (drop-and-recreate migration).
- Payments are modeled (`event_plans`, `event_payments`, `user_event_plans`) with manual admin activation in v1; no payment provider SDK yet.
- Monthly creation limits (8 free / 21 paid) are account-level: the account's `user_event_plans` determines the limit; plan caps apply per-event capacity.
- On free-tier events the single organizer judges implicitly (organizer capability includes judging); one active role per user per event is preserved.
- Technical specs: `data-model.spec.md`, `engine.spec.md`, `api.spec.md`, `ui.spec.md`, `verification.spec.md` (same directory).

Business rules (added 2026-09-14):

- A community event's scheduled start may be at most **2 months in advance** (validated at creation and whenever the start date changes). Editorial (seed-origin) events are exempt.
- **Payment gate** (community events only): an event must have a **registered payment** (its plan registered — the free plan is self-registered by the organizer at no cost) within **3 days** of creation:
  - Day 0–3: event fully editable; a highlighted announcement shows that a payment must be registered to move forward, with the deadline.
  - Day 3 (no registered payment): the event is **locked** — every feature and data becomes read-only for every user of the event; only the payment action stays enabled; the organizer is notified (in-app highlighted notice on the event surfaces and their event list).
  - Day 6 (still no registered payment): the event is **disabled definitively**. Payment registration is rejected from that point; only an administrator can intervene.
  - Registering a payment (any plan, free included) at any time before day 6 re-enables everything permanently.
  - Enforcement is lazy (computed from `created_at` + active payment at read/write time — no cron): mutations throw a typed lock error; reads always work.

Decisions (2026-09-14, notifications & infra):

- **No PGMQ / no worker**: the app has no resident consumer process (Cloudflare Workers + Supabase) and all work fits in-transaction. Revisit triggers: a real payment provider (webhook ingestion), notification fanout beyond in-app, heavy async recomputation.
- **User notifications v1 = in-app only**: a `user_notifications` table (migration `0028`), rows written **inside the same DB transaction** as each league mutation (next to the realtime signal insert — no queue). Bell + unread badge in the shell, `/notifications` page, realtime via `supabase_realtime` channel `user:<uid>` (insert-trigger broadcast, same pattern as `event_realtime_signals`), poll-on-focus fallback.
- **Email phase (deferred)**: provider = **Resend**; a **`pg_cron` daily sweep** (approved) computes payment-gate states read-only and fans out day-2/3/6 reminders + results/invite emails; per-user email preferences ship with it; web push (VAPID) later still.
- Gate states `locked`/`disabled` are derived in-app (`PaymentGateNotice`) for v1 — the sweep only matters once delivery pushes exist.


requirements

- the User experience U/X must be intuitive and clean.

- it must be aligned @DESIGN.md @global.css.

- must use the current sport-event data model.

- every sport-event must plus the points and rank to each attended rider.

- this section must have its own engine.

- it would have an administration sections.

- a sport-event has 3 roles:
  -- Main organizer
  -- Event organizers
  -- riders
  -- Judges

- free tier & paid has the same features, diffence are the amount of participants.

- free tier:
  -- any user can create until 8 sport-events, montly.
  -- a sport-events only allow 1 organizer, who is judge at the same time, and 3 riders.

- payment tier:
  -- amount of payments dependence of the number of participants - judges - organizers: free: 3Riders; $5: 13Riders; $21: 55Riders or more;.
  -- system administartor set the values for the different types of payments.
  -- any user can create until 21 events montly.
  -- only the main organizer can remove judges, riders, or other organizers.

- attenting users (riders, judges, organizers) must be signed-in.

- a sport-event can have many organizers, many jugdes & many riders.

- the sport event is created by default with: 1 organizer, 0 judges, 0 riders; then can be added payments or keep in free tier.

- when a sport-event is not free tier, are enable the rest of features.

- a user can only have 1 role by sport-event.

- a user can have different roles through differents sport-events.

- parameters for judge's make califications:
  -- style, consistency, amplitude, technique

- happy path:
  -- the organizer create a sport-event.
  -- the sport-event can be free or with pay.
  -- the organizer set date, name, and rest of sport-events' fields.

  -- the organizer share the event through link, code, qr-code.
  -- organizers, judges and competitors self joined to the sport-event using the shared item (link, code, qr-code).

  -- the organizer close subscriptions.
  -- the system set a schedule for the event.
  -- The organizer start the contest.

  -- each rider are evaluated by the judges - realtime in a window time.
  -- the results of the contest are registered in database and published.

Features by role

Event Organizer:

- Must have a sport-event configuration view.
- edit event fields.
- set multi-parameters for califications: style, consistency, amplitude, technique
- Add competitors, Judges and more organizers.
- Set a spot associated to the event.
- can create links & QR for event sharing for judges, riders & other organizers.
- view for the sport-event metrics about the atlete's performans real-time and as an hystoric resource.

Judges:

- review their events subscriptions.
- review of their schedule.
- review their results.
- make its work through a view (only touching view style).
- review their hystoric participations.

Competitors:

- review their events subscriptions
- review their schedule
- review & share their results
- review their hystoric
- the rank and points earn in each event is setted automatically
