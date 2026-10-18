# League UI spec

Design system: `DESIGN.md` + `src/app/globals.css` (monochrome system, Plus Jakarta Sans, `--color-primary #0a0a0a` reserved for CTAs/active/critical, gradient only for marketing surfaces, `radius-lg` 16px or `full`, 64px shell chrome, `text-base sm:text-sm` inputs for 16px mobile rendering). This doc fixes surfaces, roles, states and a11y requirements.

## Surfaces

| Route | Audience | Content |
|---|---|---|
| `/sport-events` | public | directory grid + featured hero; league badges (`Registration open`, `Live`, `Results`); filter tabs keep upcoming/live/completed; `Join with code` header entry (input → `/sport-events/join/<code>`, trimmed and case-sensitive); signed-in-only `Create event` CTA → `/league/new` (hidden for guests; the `/league/new` server gate remains the enforcement backstop) |
| `/explore`, `/map`, landing marquee | public | unchanged layouts, new event DTO (`category`, league badges); events only shown when `visibility='public'` |
| `/sport-events/[slug]` | public + member | role-aware detail: info/dates/location/category, join CTA (sign-in gate), roster count, schedule list, live run board, results table, share (link/code/QR) |
| `/sport-events/join/[code]` | signed-in | invite preview (event name, date, role) → sign-in gate (reuse `ChallengeSignInGate` pattern) → join confirm → redirect |
| `/sport-events/[slug]/manage` | organizer | event config form (name, dates/timezone, location/spot, category, visibility), scoring criteria editor (defaults style/consistency/amplitude/technique, weight/max), members manager, invites manager (per-role link + QR via `qrcode.react`), registration controls, schedule editor (order + slot minutes), start/complete/publish/cancel controls, live console (runs, submitted scores, judge progress) with realtime updates, historic metrics, plan/payment panel (free self-register / paid upgrade request). While the payment gate is `pending`/`locked`, a highlighted `PaymentGateNotice` announcement (deadline countdown + pay CTA) is shown and every other control is disabled |
| `/sport-events/[slug]/judge` | judge / organizer | touch-first queue: current run, countdown to window end, one control per criterion (sliders/steppers), submit + revise, past submissions list |
| `/league` | signed-in | hub: my events grouped by my role (organizer/judge/rider), subscriptions, quick links, history; compact `Have a code?` join entry (same code → preview flow) |
| `/notifications` | signed-in | in-app notification list (cursor-paginated, newest first): unread rows highlighted, per-row deep link from `payload` (event/console/judge route), mark-read on open + bulk "mark all read"; empty state copy |
| `/admin/league/plans` | admin (`league.manage`) | plan table + form: price, currency, caps, monthly limit, active/default |
| `/admin/league/payments` | admin | payment queue (pending/paid/comped/refunded), mark-paid/comp/refund actions with event + plan context |
| `/admin/events` | event curators | existing CRUD adapted to `category` naming + new optional fields (visibility, timezone) |

## Interaction rules

- All member actions go through `useLeagueAction` (UUID idempotency key per action, one transport retry with same body, stale-version auto-refresh + retry) — no optimistic writes; UI reflects server state after `{id, version}` responses.
- Realtime views (organizer console, judge queue, live board, rider results) use `useLeagueRealtime`; show `connected | reconnecting` badge; degrade to polling transparently.
- Judging window: submit control disabled outside the window with a visible countdown; window extension available to organizer inline.
- Publish results is a confirm-dialog action (freeze semantics, not undoable in v1).
- Cancellation and member removal are confirm-dialog actions with consequence copy.

## States & a11y

- Every list surface: loading skeleton, empty state (no events / no members / no runs / no results / no invites), error boundary with retry.
- Forms: 16px controls on mobile (`text-base sm:text-sm`), labeled inputs, error text tied via `aria-describedby`, focus moved to first error on submit.
- Judge view: single column, ≥44px touch targets, no drag interactions; score changes announced via `aria-live="polite"`; keyboard operable throughout.
- Status/badges: text + color (never color alone), contrast ≥ AA.
- Dialogs: focus trap, ESC to close, focus restored.
- Reduced motion respected for countdown/transition animations.

## Notifications surfaces (v1, in-app)

- Shell bell (header chrome, 64px height rules): unread badge (count ≥ 1, cap "99+"), opens `/notifications`; badge from `GET /api/notifications` `unreadCount` (always in the payload; `?unread=1` filters the list) cached in a `useNotifications` hook.
- Realtime: `user:<uid>` channel insert → debounced refetch; poll-on-focus fallback when channel stalls; `aria-live="polite"` announcement on new notifications while the bell is focused.
- Rows: type icon + copy from `definitions.ts` renderer + relative time; unread dot + `read_at` write-through (`POST /api/notifications/read`); deep links respect auth (member-only routes redirect through the sign-in gate).
- Email/push do not exist in v1 — Phase 5 (Resend + pg_cron sweep) will reuse the same notification rows.
