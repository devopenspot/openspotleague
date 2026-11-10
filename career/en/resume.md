# Résumé (1 page) — English

Keep it to 4–6 bullets; drop the least relevant one for each job. Use **one** of the two versions, never both.

## Version A — Experience section

**Founder & Full-Stack Engineer** — OpenSpot League (self-employed) · [City, Country] / Remote · [Mon] 2026 – Present
*Action sports platform (spot map, judged contests, multiplayer games) · live in pre-launch at openspotleague.com*

- Designed, built and deployed the full product solo: Next.js 16 / React 19 / TypeScript on Cloudflare Workers, Supabase PostgreSQL + PostGIS, Cloudflare R2.
- Implemented a contest rating engine from the World Skate judging criteria (five criteria, trimmed-mean judge panel, division rankings, league points), with live and video judging.
- Built real-time multiplayer trick games using optimistic concurrency control, idempotent writes and Supabase Realtime.
- Built an event-driven email notification pipeline on AWS (SQS FIFO → Lambda → SES, DynamoDB idempotency, EventBridge schedules), defined with AWS CDK.
- Architected a layered service/repository backend with role-based access control, row-level security, rate limiting and security headers.
- Reduced database egress and hosting cost with server caching (Next.js Cache Components, remote cache) and post-commit invalidation; ~270 automated test files.

## Version B — Projects section

**OpenSpot League** — openspotleague.com · [Mon] 2026 – Present
*Solo full-stack project · Next.js, React, TypeScript, PostgreSQL/PostGIS, Supabase, Cloudflare Workers*

- Action sports platform with a geospatial spot map, judged contests and real-time multiplayer games; live in pre-launch.
- Built a rating engine based on World Skate criteria and real-time games with optimistic concurrency and Supabase Realtime.
- Event-driven email notifications on AWS (CDK, SQS, Lambda, SES, DynamoDB, EventBridge).
- Deployed to Cloudflare Workers with server caching, RBAC + row-level security and ~270 test files.

## Skills line

**Languages & frameworks:** TypeScript, JavaScript, SQL, React 19, Next.js 16, Node.js, Tailwind CSS
**Data & infrastructure:** PostgreSQL, PostGIS, Supabase (Auth, Realtime), Drizzle ORM, Cloudflare Workers, R2, Hyperdrive, AWS (CDK, Lambda, SQS, SES, SNS, DynamoDB, EventBridge)
**Practices:** system design, event-driven architecture, infrastructure as code, caching, real-time systems, automated testing (Vitest), security (RBAC, RLS)

## Tips

- Put the most relevant bullet first for each job (backend role → architecture/caching; frontend → UI system/map; product → League).
- When you have users, replace the last bullet with a traction bullet (see `../README.md`).
