# CV (long form) — English

## Founder & Full-Stack Engineer — OpenSpot League
Self-employed · [City, Country] / Remote · [Month] 2026 – Present · https://openspotleague.com

### Overview
OpenSpot League is a web platform for the action sports community (skateboard, BMX, scooter and roller).
It combines an interactive map of spots, a competition system ("the League") with real judging,
multiplayer trick-challenge games and curated action sports TV. I founded the project and am its only
engineer: I own product, design, architecture, development, deployment and operations. The platform is
live on its production domain in pre-launch, ahead of a public release.

### Responsibilities
- Product definition, roadmap and UX for riders, contest organizers and judges.
- Full-stack development: UI, API routes, domain logic, database schema and migrations.
- Infrastructure, deployment, monitoring of database usage and cost.
- Security, access control and data protection (privacy policy and terms pages).

### Main features
- **Spot map.** Interactive Leaflet map of spots with geospatial queries in PostGIS, filters by discipline and
  spot type, spot pages, saved spots and user-submitted spots.
- **The League (contests).** Organizers create contests with divisions (discipline × format), invite riders by
  QR code or link, and judge runs live or from submitted videos. A rating engine implements the World Skate
  criteria (Park, Street and Vert formats; five criteria; required elements per discipline; 0–10 scores;
  trimmed-mean judge panel; division rankings). Results publish to standings, shareable result cards and a
  global ranking with league points. Riders only see panel totals until results are published.
- **Plans and listing.** Free contests stay unlisted (invite only); public listing requires a paid plan, with
  admin tools for plans, quotas and payments.
- **Multiplayer games.** Real-time trick-challenge games built as pure state machines, with versioned
  (optimistic concurrency) and idempotent writes and Supabase Realtime signals.
- **Notifications.** In-app notifications over Supabase Realtime plus an event-driven email pipeline on AWS:
  a transactional outbox hands jobs to an SQS FIFO queue (per-user ordering, deduplication, dead-letter queue),
  a Lambda sends through SES v2 with one-click unsubscribe and DynamoDB idempotency, SES bounces and complaints
  flow back through SNS to suppress addresses, and EventBridge Scheduler drives reminders and digests. Requests
  to AWS are SigV4-signed from the Worker; callbacks to the app are HMAC-signed. Infrastructure defined with AWS CDK.
- **Action sports TV**, profiles, notifications, admin and curation tools, and generated Open Graph share images.

### Architecture and engineering
- Next.js 16 App Router with React 19 and Cache Components, built with Vite (vinext) and deployed to
  Cloudflare Workers; PostgreSQL reached through Cloudflare Hyperdrive; media on Cloudflare R2.
- Layered design: pages and route handlers → services (orchestration, single writers) → repositories (Drizzle ORM).
  Domain engines (games, league, rating) are pure, IO-free and unit-tested.
- Transactional write path with optimistic concurrency, request fingerprints for idempotency, and post-commit
  cache invalidation.
- Caching strategy (shared remote cache for public reads, private cache for user data) designed around a
  database egress budget; build that runs without a database; RSC payload limits.
- Security: Supabase Auth, role-based access control, PostgreSQL row-level security, per-IP rate limiting,
  request IDs, strict security headers.
- Quality: strict TypeScript, ESLint, ~270 Vitest test files across ~1,070 source files, hand-written SQL
  migrations, a token-based design system (`DESIGN.md`) and written architecture documentation.

### Technologies
TypeScript · React 19 · Next.js 16 · Vite · Node.js · Tailwind CSS 4 · Leaflet · Zustand · Zod ·
PostgreSQL · PostGIS · Supabase (Auth, Realtime) · Drizzle ORM · Cloudflare Workers · Hyperdrive · R2 ·
AWS (CDK, Lambda, SQS, SES, SNS, DynamoDB, EventBridge Scheduler) · Vitest ·
Testing Library
