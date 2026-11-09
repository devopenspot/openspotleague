# Cloudflare security and request quota

The app runs on Cloudflare Workers. Every request that runs a Worker counts against the plan's request quota. On Workers Free that quota is 100,000 requests a day, and once it runs out every visitor gets Error 1027 until 00:00 UTC. This doc covers the dashboard setup that keeps bots and loops from using that quota, and how to check that it works.

None of this lives in the repo. It is all set in the Cloudflare dashboard, for the `openspotleague.com` zone and the `open-spot` Worker.

## Why it matters

- **What the quota counts.** Every Worker invocation, including requests the app rejects with `429` or `304`, and each call from `open-spot` to the cache Worker (`open-spot-response-store`). A typical page view makes about two cache-Worker calls.
- **What it doesn't count.**
  - Requests blocked by a WAF, rate-limit or bot rule. They stop at the edge before any Worker runs.
  - Files served by Static Assets without the Worker. `runWorkerFirst` in `cloudflare.config.ts` excludes `/_next/static/*`, images, `/favicon.ico` and `/og/*`.
- **Caching rules don't help.** On a Workers route the Worker runs before the CDN cache.
- **Incident, 2026-11-08/09.** From 22:00 UTC, the IAD data center (Ashburn) sent a steady 8–10k app requests an hour for 7 hours. That was 91% of all traffic, and it used up the daily quota. Normal traffic is about 7–8k Worker requests a day across both Workers.
- **Supabase egress.** Blocking at the edge doesn't change it (see `docs/caching-and-egress.md`). Don't trade Worker requests for database reads: for example, don't replace the global cache Worker with the per-data-center Cache API.

## 1. Bot settings

Dashboard → `openspotleague.com` → **Security → Settings**. On older dashboards this is **Security → Bots**.

| Setting | Value | Notes |
| --- | --- | --- |
| Bot Fight Mode | On | Challenges known bad bots. On the Free plan it can't be skipped for specific paths, so uptime monitors may get challenged. No inbound webhook routes exist under `src/app/api`, so no integration breaks. |
| Block AI bots | Block on all pages | Matches the `BLOCKED_AGENTS` list in `src/app/robots.ts`, but enforced at the edge, not just requested. |

## 2. Custom rules

**Security → Security rules → Create rule → Custom rule**. On older dashboards this is **Security → WAF → Custom rules**. The Free plan allows 5 custom rules. For each rule, click **Edit expression** and paste the expression.

### Rule A: block scripted clients

- **Action:** Block

```
(http.user_agent eq "")
or (lower(http.user_agent) contains "python-requests")
or (lower(http.user_agent) contains "go-http-client")
or (lower(http.user_agent) contains "scrapy")
or (lower(http.user_agent) contains "headlesschrome")
or (lower(http.user_agent) contains "curl/")
or (lower(http.user_agent) contains "wget")
```

`pnpm og:check` sends `facebookexternalhit/1.1 (+openspot og:check)` (`OG_CHECK_USER_AGENT` in `src/lib/og/check.ts`), so this rule doesn't block it. If you add a script that hits production, give it a named user agent that this rule doesn't match.

### Rule B: challenge cloud-server networks

- **Action:** Managed Challenge

Real visitors almost never browse from data-center networks; scrapers usually do.

```
(ip.src.asnum in {14618 16509 15169 396982 8075 14061 16276 24940 63949 20473})
and not cf.client.bot
and not starts_with(http.request.uri.path, "/og/")
and not (http.request.uri.path contains "opengraph-image")
```

- **Networks (ASNs):** AWS (14618, 16509), Google (15169, 396982), Microsoft (8075), DigitalOcean (14061), OVH (16276), Hetzner (24940), Linode (63949), Vultr (20473).
- `not cf.client.bot` keeps verified crawlers (Google, Bing) in.
- **The path exclusions keep share previews working.** WhatsApp, Discord, Slack and others fetch OG images from cloud servers, and a challenge would break their link cards.
- **A challenge can't be solved by `fetch()`.** A real user on a VPN hosted in one of these networks can load pages after passing the challenge, but their API calls may fail until they do. If that shows up in Security → Events, narrow the rule to pages only by adding `and not starts_with(http.request.uri.path, "/api/")`.

### Rule C: block a specific source (only during an incident)

- **Action:** Block

1. Open **Security → Analytics** (or **Events**) for the incident window. Look at top IPs, ASNs, user agents and paths.
2. **Check the paths before blocking.**
   - Mostly `/api/games/…` or `/api/league/…` from a normal browser user agent means our own client is stuck in the polling fallback. Don't block it: that's a code bug, and the back-off in `src/lib/games/realtime.ts` (`nextPollDelayMs`) is the fix.
   - Pages, sitemap URLs or random paths from a bot user agent or a cloud network means a scraper. Block it.
3. Write the rule with the identifiers you found, for example:

```
(ip.src in {203.0.113.10 198.51.100.0/24})
```
```
(ip.src.asnum eq 12345)
```

4. Remove the rule once the source has been gone for a few weeks, so it doesn't use up one of the 5 slots.

## 3. Rate limiting rule

**Security → Security rules → Create rule → Rate limiting rule**. The Free plan allows 1 rule.

| Field | Value |
| --- | --- |
| Expression | `starts_with(http.request.uri.path, "/api/")` |
| Counting characteristic | IP (fixed on Free) |
| Requests / period | 30 per 10 seconds |
| Action / duration | Block for 10 seconds (fixed on Free) |

- **Why 30 per 10 seconds.** A game in progress polls every 2s at most (`POLL_INITIAL_DELAY_MS`), which is 5 requests per 10s. Even with other API calls, a real user stays well under 30, so the rule only catches loops and floods.
- **If you lower the client poll interval,** re-check this threshold and the proxy tier limit (`docs/caching-and-egress.md`, "Polling and realtime").

## 4. Workers Paid plan ($5 a month)

Dashboard → **Workers & Pages → Plans**. This is the recommended safety net. It's cheaper than any Supabase upgrade and doesn't change egress.

| Limit | Free | Paid |
| --- | --- | --- |
| Worker requests | 100k a day, hard stop (Error 1027) | 10M a month included, then $0.30 per million |
| Durable Objects (cache Worker storage) | 100k requests a day | 1M a month included |
| Hyperdrive queries | 100k a day | No daily limit |
| CPU per request | 10 ms | 30 s by default |

At 1,000 users a day we estimate about 25–50k Worker requests a day. That fits on Free if bots are kept out. It's about 1–1.5M a month on Paid, inside the included 10M, so the bill stays $5. A burst like the November incident (about 60k requests in 7 hours) takes the site down on Free, and costs cents on Paid.

## 5. Check it works

1. **Same day:** open **Security → Events** and filter by each rule.
   - Look for real users being challenged, especially by Rule B.
   - Look for `/api/` blocks from the rate limit that look like normal play.
2. **Next day:** open **Workers & Pages → open-spot → Metrics**, and the same view for `open-spot-response-store`. Daily requests should be a few thousand, with no single data center far above the rest.
3. **Weekly, while traffic grows:** compare cost with users.
   - Find daily egress on the Supabase dashboard's **Usage** page.
   - Divide it by daily unique visitors from **Cloudflare Analytics** to get KB per visitor.
   - The budget is about 160 MB a day, or about 160 KB per visitor at 1,000 users a day. Above about 120 KB per visitor, work on egress before traffic grows.
   - `pnpm egress:snapshot` shows which queries the egress comes from.
   - Never query Supabase logs for this (see `AGENTS.md`).

## 6. During an incident

1. **Error 1027:** the daily quota is gone. It resets at 00:00 UTC. Upgrading to Workers Paid restores the site within minutes.
2. **Find the source:** use Security → Analytics for the spike window. Workers Metrics breaks requests down by data center but not by path.
3. **Decide what it is** using Rule C's path check: our own client (fix the code) or a third party (add Rule C).
4. **Turn on Workers Observability** (Workers & Pages → open-spot → Settings → Observability) if it's off, so the next spike has path-level data.
