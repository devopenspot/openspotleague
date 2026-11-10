# LinkedIn — English

Profile: https://www.linkedin.com/in/gabriel-alfonso-bernal/

## Headline (≤ 220 characters)

```
Full-Stack Engineer · Founder of OpenSpot League | Next.js · React · TypeScript · PostgreSQL/PostGIS · Supabase · Cloudflare Workers
```

## About (≤ 2,600 characters)

Add your own first paragraph (years of experience, past roles, what you are looking for), then:

```
[1–2 sentences about you: years of experience, the kind of products you build, what you are looking for.]

I'm the founder and sole engineer of OpenSpot League (openspotleague.com), a platform for the action sports community: an interactive map of skate spots, contests with real judging, multiplayer trick games and action sports TV for skateboard, BMX, scooter and roller riders.

I designed and built it end to end — product, UI system, architecture, database and deployment — on Next.js 16, React 19 and TypeScript, running on Cloudflare Workers with Supabase (PostgreSQL + PostGIS, Auth, Realtime). It's live in pre-launch, ahead of a public release.

What I enjoy most: turning messy real-world rules into clean, tested domain logic (like a contest rating engine based on the World Skate criteria), building real-time features that stay correct under concurrency, and keeping production fast and cheap with good caching.

Stack: TypeScript · Next.js · React · Node.js · PostgreSQL · PostGIS · Supabase · Drizzle ORM · Cloudflare Workers / R2 · AWS (CDK, Lambda, SQS, SES, SNS, DynamoDB, EventBridge) · Tailwind CSS · Vitest
```

## Option A — Experience entry

| Field | Value |
| --- | --- |
| Title | Founder & Full-Stack Engineer |
| Employment type | Self-employed |
| Company | OpenSpot League |
| Dates | [Month] 2026 – Present |
| Location | [City, Country] · Remote |
| Skills (pick 5) | Next.js · TypeScript · React · PostgreSQL · Cloudflare Workers |
| Media | Screenshot of the map, of a contest page, link to openspotleague.com |

Description (≤ 2,000 characters):

```
OpenSpot League (openspotleague.com) is a web platform for the action sports community — skateboard, BMX, scooter and roller. I designed, built and operate it end to end. It is live on its production domain in pre-launch, ahead of a public release.

• Built an interactive map of skate spots with geospatial search (PostGIS) and user-submitted spots.
• Built the League: organizers create contests with divisions, QR/link invites and live or video judging, scored by a rating engine I implemented from the World Skate criteria (five criteria, 0–10 scale, trimmed-mean judge panel, division rankings and global league points).
• Built real-time multiplayer trick-challenge games with optimistic concurrency control, idempotent writes and Supabase Realtime.
• Built an event-driven email notification pipeline on AWS for contest updates, reminders and results: transactional outbox → SQS FIFO (with dead-letter queue) → Lambda → SES, idempotency in DynamoDB, bounce handling through SNS, scheduled digests with EventBridge Scheduler, all defined as code with AWS CDK.
• Architected a layered Next.js 16 / React 19 app (pages → services → repositories) deployed to Cloudflare Workers, with PostgreSQL through Hyperdrive and media on Cloudflare R2.
• Kept hosting costs low with server-side caching (Next.js Cache Components, shared remote cache), post-commit cache invalidation and a database egress budget.
• Secured the platform with role-based access control, PostgreSQL row-level security, per-IP rate limiting and strict security headers.
• Kept quality high with strict TypeScript, ~270 automated test files (Vitest) and a token-based design system.
```

## Option B — Projects section entry

| Field | Value |
| --- | --- |
| Project name | OpenSpot League |
| Dates | [Month] 2026 – Present ("I am currently working on this project") |
| Associated with | (leave empty, or your current position) |
| Project URL | https://openspotleague.com |
| Skills | Next.js · TypeScript · PostgreSQL · Supabase · Cloudflare Workers |

Description:

```
Full-stack platform for action sports riders (skateboard, BMX, scooter, roller), built solo and live in pre-launch at openspotleague.com.

• Interactive spot map with geospatial search (PostGIS).
• Contests with live or video judging, scored by a rating engine based on the World Skate criteria.
• Real-time multiplayer trick games (Supabase Realtime, optimistic concurrency).
• Event-driven email notifications on AWS (CDK, SQS, Lambda, SES, DynamoDB, EventBridge).
• Next.js 16 + React 19 on Cloudflare Workers, PostgreSQL via Drizzle and Hyperdrive, media on R2; ~270 test files.
```

## Featured link

- URL: `https://openspotleague.com`
- Title: `OpenSpot League — spots, contests and games for action sports`
- Description: `A platform I founded and built solo: skate spot map, judged contests, multiplayer trick games and action sports TV. In pre-launch.`

## Skills to add

Next.js · React · TypeScript · JavaScript · Node.js · PostgreSQL · PostGIS · Supabase · Drizzle ORM · SQL ·
Cloudflare Workers · AWS · AWS Lambda · Amazon SQS · Amazon SES · AWS CDK · DynamoDB · Serverless · Event-driven architecture · Tailwind CSS · Vitest · Real-time systems · System design · Web performance ·
Caching · REST APIs · Product development · UI design
