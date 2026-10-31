---
description: Audit changes for Supabase shared-pooler egress and log query/ingest usage against official Supabase guidance and the OpenSpot rules
argument-hint: "[path | git-range]  (default: working tree + branch diff vs main)"
allowed-tools: Bash(git diff:*), Bash(git status:*), Bash(git log:*), Bash(grep:*), Bash(rg:*), Read, Glob, Grep
---

# Supabase egress and log usage audit

Run this before finishing any change that touches database reads or writes, caching, layouts, API routes, polling or realtime, migrations, auth, storage, scripts, or MCP and agent config. Report findings; don't edit code unless the user asks.

Scope: `$ARGUMENTS`. If it is empty, use the uncommitted changes plus the branch diff:

```bash
git status --short
git diff HEAD --stat; git diff main...HEAD --stat
git diff HEAD; git diff main...HEAD
```

If `$ARGUMENTS` is a path, audit those files. If it is a git range, use `git diff <range>`.

## Why this exists (official Supabase facts, checked 2026-10-30)

**Egress** ([manage egress](https://supabase.com/docs/guides/platform/manage-your-usage/egress), [all about egress](https://supabase.com/docs/guides/troubleshooting/all-about-supabase-egress-a_Sg_e)):
- Every service produces egress: Database (PostgREST), **Shared Pooler** (Supavisor), Auth, Storage, Edge Functions, Realtime, and Log Drains.
- Traffic through the pooler is counted only as Shared Pooler Egress, not also as Database Egress.
- All uncached egress shares one **Unified Egress quota**:

  | Plan | Uncached egress | Cached egress | Overage (uncached / cached) |
  | --- | --- | --- | --- |
  | Free | 5 GB | 5 GB | — |
  | Pro / Team | 250 GB | 250 GB | USD 0.09 / USD 0.03 per GB |

- Usage accumulates over the billing cycle and can't be reduced retroactively.
- Supabase's own advice: select fewer columns and fewer rows; cut query volume with caching; don't return whole rows from inserts or updates; trim manual backups that go through Supavisor.
- Supavisor egress can't be traced to a single query. The closest proxy is **Query Performance** (`pg_stat_statements`: calls × average rows). This repo wraps that in `pnpm egress:snapshot`.
- OpenSpot runs on the Free plan, so the budget is 5 GB/month, about **160 MB/day**.

**Logs** ([logs query](https://supabase.com/docs/guides/platform/manage-your-usage/logs-query), [logs ingest](https://supabase.com/docs/guides/platform/manage-your-usage/logs-ingest)):
- **Logs Query** counts the GB *scanned* by every read, whether from Studio, the Management API, the CLI, or MCP.
  - Results are never cached, so every poll rescans the data.
  - The time range is the biggest factor: a 1-day window scans about 7× less than a 7-day window.
  - Filtering in the query (by source or service) reduces the scan; filtering the results afterwards does not.
- The query allowance is 100 × log ingest. The Free plan includes 1 GB of ingest, so about 100 GB of query. Paid plans include 20 GB, so about 2,000 GB.
- The allowance isn't enforced yet. Once it is, going over puts the next month into a degraded state: 10 queries/min and 1 h retention on Free. Going over again cuts off log access for the following month.
- OpenSpot scanned **228 GB on Oct 28–29, 2026**, more than twice the monthly Free allowance in two days.
- **Logs Ingest** on Free is 1 GB. The biggest levers are `log_statement`, `log_min_duration_statement`, `pgaudit.*`, `log_connections` / `log_disconnections`, `log_min_messages`, and `RAISE NOTICE` / `RAISE LOG` inside hot functions.

**Pooler** ([connecting to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres)):
- Serverless code uses transaction mode on `:6543` with `prepare: false`, `ssl: require`, a small pool, and a client created once at module scope.
- Transaction mode doesn't keep `SET`, session advisory locks, `LISTEN`/`NOTIFY`, or temp tables between transactions.
- Direct `:5432` is for migrations and DDL only.

## Checks

For each check, search the scoped diff or files first. Only open a full file to confirm a hit. Use `rg`, or `grep -rn` with quoted `--include='*.ts'` (zsh expands unquoted globs).

### A. Log query and log ingest (hard bans)

1. **No log reads from code, scripts, or agents.**
   - Flag `get_logs`, `analytics/endpoints/logs`, `/v1/projects/.*/analytics`, `logs.all`, `edge_logs`, `postgres_logs`, `function_logs`, `auth_logs`, `supabase logs`, and `supabase inspect` run in loops.
   - Flag any cron job, interval, or CI step that queries logs.
   - **Never run any of these yourself.** Use `pnpm egress:snapshot` or `pg_stat_statements` instead.
2. **MCP config.** Check `.mcp.json`, `.claude/settings*.json`, `~/.claude.json` mentions, and `.cursor/mcp.json`. Any Supabase MCP entry must be exactly `https://mcp.supabase.com/mcp?project_ref=<ref>&read_only=true&features=docs,database`. Flag `features` that include `debugging` or `development`, a missing `read_only=true`, or `@supabase/mcp-server-supabase` without `--read-only --features=docs,database`.
3. **Dashboards and reports.** Flag any doc, script, or instruction that tells someone to auto-refresh Logs Explorer, run log-based Observability reports, or widen a log time range. Continuous feeds must use a Log Drain.
4. **Ingest growth in migrations and SQL.**
   - Flag `RAISE NOTICE`, `RAISE LOG`, or `RAISE INFO` in functions or triggers on hot paths.
   - Flag `ALTER (SYSTEM|DATABASE|ROLE) ... SET log_*` and `pgaudit.*`.
   - Flag a lowered `log_min_duration_statement`, `log_statement` set to `all`, and `log_connections` turned on.
5. **App-side logging that ships to Supabase.** Flag new `console.log` or `RAISE` calls in Postgres functions or Edge Functions that run per request. App logs through `src/lib/log.ts` go to Vercel and are fine.

### B. Shared pooler egress (bytes = rows × width × calls)

6. **Row width.**
   - Flag new `db.select().from(...)`, `findMany` / `findFirst` without `columns:`, and `select *` in repositories or SQL that serve wide tables (`spots`, `sport_events`, `tv_videos`, games).
   - Select only the columns the caller renders.
   - Flag `.returning()` with no column map on insert, update, or delete; return `{ id }` or the minimum needed.
7. **Row count.** Flag list queries with no `.limit(...)` or keyset pagination, any query that loads a whole country or region, and `count(*)` scans on hot paths.
8. **Call volume.**
   - Flag `await` on a repository or service call inside `for` / `.map` / `Promise.all(items.map(...))`; that is an N+1 pattern.
   - Flag duplicate fetches across a layout and its page.
   - Flag a child layout that refetches data `RootLayout` already provides.
   - Flag weather or other per-spot data fetched during SSR.
9. **Round trips.** Flag `db.transaction` around reads or point lookups; reads use `withDbRead`. Flag sequential permission queries; use `getAuthorizationSnapshotCached(userId)`.
10. **Cache scope.**
    - A new public, high-fanout read (map, directory, regions, spot types, cities, shuffle ids, event or TV lists) must be `"use cache: remote"` with `cacheTag` and a `cacheLife` profile from `src/lib/cache/lifetimes.ts`, and each entry must stay under 2 MB.
    - Flag a plain `"use cache"` on such reads: on Vercel serverless it almost always misses.
    - Flag uncached service reads on public pages.
11. **Invalidation.** Flag `revalidateTag` inside a transaction (use `queueTagRevalidate`), inline cacheLife literals, and over-broad tags that wipe large remote caches on every write.
12. **Polling and realtime.**
    - A polling endpoint needs a single-query version check that returns `304` with an empty body before any join or transaction.
    - Client intervals must stay under the proxy tier limit.
    - Terminal entities return `Cache-Control: private, max-age=300, stale-while-revalidate=3600`.
    - Realtime signal rows stay small (ids and version only), subscriptions filter by entity, and signals with `signalVersion <= current` are ignored. Realtime pushes count as egress too.
13. **Connection config.** Flag any `postgres(...)` or `drizzle(...)` created outside `src/lib/db/` / `getPostgresOptions`, and any per-request client creation. Also flag `prepare: true`, a missing `ssl: "require"`, raised `DB_POOL_MAX` or `DB_CONCURRENCY_MAX`, and session-mode-only features (`LISTEN`, session advisory locks, `SET` without `LOCAL`) on the `:6543` runtime path. Session advisory locks are allowed only in `src/db/apply-sql.ts`, which runs on the direct connection.
14. **Build and dev.**
    - The build must stay DB-free (`connection()` + `withSafeDefault*`).
    - For local dev, run `grep -oE '@[^:/?]+:[0-9]+' .env.local`. It prints `@host:port` only, never credentials, so never print the whole file. If it shows `*.pooler.supabase.com` for the production project ref, warn that dev traffic and HMR cache busting are billed to production.
    - Seed, reset, and scripts must use `SUPABASE_DIRECT_URL` and run against non-production.
15. **Other egress meters.**
    - **Auth:** no `supabase.auth.getUser()` per request on hot paths. The proxy uses `getClaims` with a cached JWKS, and anonymous requests skip it.
    - **Storage:** media goes through the R2 CDN domains, not Supabase Storage downloads; never enable Next image optimization.
    - **PostgREST:** flag new client-side `supabase.from(...)` reads that bypass the services layer.
16. **RSC payload.** Flag raw DB rows or `.raw` back-pointers passed to Client Components. Projections should be minimal (`MapSpot`, `MarqueeEventInput`, ...).

## Measuring (only if the user asks, or a finding needs numbers)

- `pnpm egress:snapshot` before and after the change. It diffs `pg_stat_statements` (calls and rows per statement) against the 160 MB/day ceiling.
- Never use Supabase logs to measure.
- Remember the snapshot command itself queries the database, so run it sparingly against production.

## Report format

```
## Supabase egress audit — <scope>

Verdict: PASS | PASS WITH NOTES | FAIL

| # | Severity | Check | Location | Problem | Fix |
|---|----------|-------|----------|---------|-----|
| 1 | blocker  | A1    | scripts/x.ts:42 | polls /analytics/endpoints/logs every 60s | remove; use pnpm egress:snapshot |

Estimated impact: <rows × approx bytes × calls/day, when you can estimate it>
Not checked: <anything skipped and why>
```

Severity:
- **blocker**: any A1–A3 violation, a new unbounded or wide hot query, a public fan-out read without remote cache, or a polling endpoint without a 304 pre-check.
- **warn**: likely egress increase, needs a judgment call.
- **note**: minor or hygiene.

If nothing is found, say PASS and list the checks that applied to this scope.
