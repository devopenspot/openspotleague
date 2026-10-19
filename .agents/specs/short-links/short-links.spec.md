# Short Links System Specification

Comprehensive architectural and engineering specification for same-domain, high-performance, low-cost short URL generation and edge-cached redirection across the OpenSpot platform.

---

## 1. Executive Summary & Design Goals

The Short Links subsystem provides a unified, lightweight URL shortener for all shareable content in OpenSpot (spots, sport events, challenge games, TV clips, user profiles, and map views).

### Primary Invariants
1. **Same-Domain Operation**:
   - Short links use the `/s/[code]` path prefix on the same primary domain (e.g., `https://openspotleague.com/s/7xK9q2A`).
   - Using `/s/` prevents routing ambiguity and avoids collision with existing and future Next.js App Router root paths (`/spots`, `/events`, `/games`, `/tv`, `/api`, `/admin`, `/login`, `/profile`, `/map`, `/robots.txt`, `/sitemap.xml`, etc.).
2. **Sub-10ms Edge CDN Redirects (Zero-Write Redirect Path)**:
   - Redirect requests (`GET /s/[code]`) return `307 Temporary Redirect` with edge surrogate caching:
     ```http
     Cache-Control: public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800
     ```
   - Global CDN edges (Vercel Edge Network) cache the 307 response for 24 hours. Subsequent clicks worldwide are resolved at edge locations with **0 database queries**, $<10\text{ms}$ latency, and $\$0$ database compute egress.
   - **Zero Synchronous Writes on Read**: Unlike legacy shorteners that execute `UPDATE short_links SET clicks = clicks + 1` synchronously on every click, OpenSpot deliberately decouples redirection from telemetry to maintain pure CDN cacheability and protect Postgres connection pools.
3. **Storage & Cost Minimization via Target URL Deduplication**:
   - `target_url` carries a unique database index.
   - Repeated shares of the same spot, event, or view reuse the existing short code rather than allocating new database rows.
   - Storage footprint is bounded ($<150\text{ bytes}$ per row). 10,000 unique shared destinations consume $<1.5\text{MB}$ in Postgres.
4. **Resilient Client UX & Offline Fallback**:
   - Generating short links is non-blocking. If a user is offline or the network API experiences transient latency, the UI instantly defaults to the canonical long URL. Zero broken shares.
   - In-memory Promise deduplication guarantees that concurrent share widgets on the same page trigger at most one network request.
5. **Enhanced Mobile QR Code Scanning**:
   - Short URLs reduce QR string length from $\sim 75$ characters to $\sim 33$ characters.
   - Reduces QR matrix complexity from Version 5 ($37 \times 37$ modules) down to Version 2 ($25 \times 25$ modules), cutting module density by $>50\%$.
   - Mobile camera scanners acquire and decode the QR code substantially faster, especially in low-light outdoor environments.

---

## 2. URL Structure, Base62 Encoding & Normalization

### 2.1 Code Alphabet & Space
- **Alphabet**: URL-safe Base62: `[0-9a-zA-Z]` (62 discrete characters).
- **Default Length**: 7 characters (e.g. `7xK9q2A`).
- **Combinatorial Space**:
  $$62^7 = 3,521,614,606,208 \text{ combinations (3.52 trillion)}$$
- **Collision Probability**:
  At 1,000,000 active unique destinations, collision chance is $< 0.000014\%$. On the off-chance of collision, the creation service retries with backoff up to 3 attempts.
- **Allowed Code Validation Pattern**: `^[a-zA-Z0-9]{4,16}$`.

### 2.2 Canonical URL Normalization
To prevent duplicate rows for functionally identical destinations:
1. **Absolute URL Stripping**: Absolute URLs matching the application domain (`env.APP_URL`, `localhost`, `*.vercel.app`, `openspotleague.com`) are stripped to canonical relative paths (`pathname + search + hash`).
2. **Trailing Slash Removal**: Trailing slashes on paths (`/spots/spot-1/` $\rightarrow$ `/spots/spot-1`) are stripped, unless root `/`.
3. **Query Parameter Sorting**: Query parameters are canonically ordered via `URLSearchParams.sort()` so `/map?spot=1&zoom=15` and `/map?zoom=15&spot=1` map to the identical short link.
4. **Protocol-Relative & Open Redirect Guards**:
   - Reject any string starting with `//` (protocol-relative phishing attack).
   - Reject any string with non-http/https protocol (`javascript:`, `data:`, `file:`).
   - Reject any string containing ASCII control characters or newlines (`[\u0000-\u001F\u007F]`).
   - Reject any external domain destination (returns HTTP 400).

---

## 3. Data Model & Database Architecture

### 3.1 PostgreSQL Schema (`short_links`)
Defined physically in `src/db/schema/index.ts` and managed via Drizzle ORM:

```sql
CREATE TABLE IF NOT EXISTS "short_links" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "code" text NOT NULL,
    "target_url" text NOT NULL,
    "title" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "short_links_code_check" CHECK (length("short_links"."code") >= 4 AND length("short_links"."code") <= 32),
    CONSTRAINT "short_links_target_url_check" CHECK (length("short_links"."target_url") > 0 AND length("short_links"."target_url") <= 2048)
);

CREATE UNIQUE INDEX IF NOT EXISTS "short_links_code_idx" ON "short_links" USING btree ("code");
CREATE UNIQUE INDEX IF NOT EXISTS "short_links_target_url_idx" ON "short_links" USING btree ("target_url");
```

### 3.2 Index Strategy & Concurrency
- `short_links_code_idx`: B-Tree index providing $O(1)$ lookups on redirect resolution.
- `short_links_target_url_idx`: B-Tree index providing $O(1)$ lookups for deduplication during creation.
- **Race Condition Handling**:
  If two concurrent requests attempt to shorten the same new destination simultaneously, Postgres enforces uniqueness via `short_links_target_url_idx`. The service catches the constraint violation and re-queries `findByTargetUrl`, returning the race winner's record seamlessly.

---

## 4. Multi-Layer Caching Architecture

```mermaid
flowchart TD
    Client["Client Browser / App"]
    Edge["Vercel Edge Network (CDN)"]
    Proxy["Next.js Proxy (src/proxy.ts)"]
    Service["Service Layer (Next.js 16 'use cache')"]
    DB["PostgreSQL (short_links)"]

    Client -- "1. GET /s/7xK9q2A" --> Edge
    Edge -- "Edge Hit (<10ms)" --> Client
    Edge -- "Edge Miss" --> Proxy
    Proxy -- "Anonymous bypass" --> Service
    Service -- "Service Cache Hit (<5ms)" --> Edge
    Service -- "Service Miss (runResolveShortLink)" --> DB
    DB --> Service
    Service --> Edge
    Edge -- "307 with s-maxage=86400" --> Client
```

### 4.1 Edge CDN Layer
- Route handler `src/app/s/[code]/route.ts` emits:
  `Cache-Control: public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800`
- `s-maxage=86400`: Instructs the CDN edge cache to keep the 307 response hot for 24 hours.
- `max-age=3600`: Client browsers cache the redirect for 1 hour. We intentionally avoid permanent `301/308` headers to prevent permanent client-side disk poisoning in case a link target is updated.
- `stale-while-revalidate=604800`: Edge serves stale responses while refreshing asynchronously if expired.

### 4.2 Application Proxy (`src/proxy.ts`)
- `/s/*` requests are strictly anonymous.
- Skips Supabase `auth.getClaims()` session token verification.
- Skips `osp_seed` cookie generation (`needsSeedForPath` applies only to `/` and `/explore`).
- Keeping `/s/*` responses `Set-Cookie`-free is an absolute prerequisite for CDN edge caching.

### 4.3 Service Layer (`"use cache"`)
- `resolveShortLink` uses Next.js 16 `"use cache"` boundary:
  ```ts
  "use cache";
  cacheTag(`short-link:${code}`);
  cacheLife(SHORT_LINK_CACHE_LIFE); // { revalidate: 86400, stale: 604800, expire: 2592000 }
  ```
- Absorbs origin hits across warm server instances even if an edge cache region experiences a cold miss.

### 4.4 Client-Side Memory Cache
- `src/lib/utils/short-url.ts` maintains an in-memory `Map<string, Promise<string>>`.
- Prevents redundant `POST /api/short-links` invocations during React re-renders, route transitions, or multiple share buttons rendered on a single view.

---

## 5. Security & Rate Limiting

1. **Anti-Phishing / Open-Redirect Defense**:
   - `normalizeTargetUrl` and `isSafeRedirectPath` validate that redirects stay within the same origin or internal relative routes.
   - Any attempt to shorten an external domain (e.g. `https://malicious.example.com`) is rejected with HTTP 400.
2. **API Rate Limiting**:
   - In `src/proxy.ts`, `POST /api/short-links` is protected by the sliding window IP rate limiter:
     `{ match: (p) => p.startsWith("/api/short-links"), limit: 30, tag: "short-links" }`
   - Mitigates automated enumeration, brute-force generation, and spamming.
3. **Input Sanitization**:
   - `code` parameter must match `/^[a-zA-Z0-9]{4,16}$/`. Invalid codes immediately redirect to `/` without executing any database query.
   - Target URL capped at 2,048 characters to eliminate payload bloat.

---

## 6. Social Crawlers & Open Graph Previews

When a short link is posted on WhatsApp, iMessage, Twitter/X, Discord, Slack, or Facebook:
1. The platform crawler sends a `GET` / `HEAD` request to `https://openspotleague.com/s/[code]`.
2. The endpoint responds with `307 Location: https://openspotleague.com/spots/[id]`.
3. Standard social crawlers follow the 307 redirect to the target page.
4. The target page (`/spots/[id]`, `/events/[id]`, `/tv`, etc.) executes its existing `generateMetadata` and `opengraph-image.tsx`, rendering rich preview cards (spot photos, discipline tags, live weather, map preview) seamlessly.

---

## 7. Frontend Integration Matrix

| Surface | File Path | Interaction | Behavior |
| :--- | :--- | :--- | :--- |
| **Share Sheet / Actions** | `src/components/ui/ShareActions.tsx` | Share, Copy Link, QR Code | Automatically shortens `url`; renders crisp short QR code; copies short URL; falls back instantly to long URL if offline. |
| **Spot Detail Actions** | `src/components/spots/detail/SpotDetailsActions.tsx` | "Share" pill button | Calls `getOrFetchShortUrl('/spots/' + spot.id)` and native `shareOrCopyUrl`. |
| **Map Popup Pin** | `src/components/map/panels/MapInfoPopup.tsx` | Share icon button | Resolves short URL for active pin and triggers native share sheet or clipboard. |
| **OpenSpot TV Theater** | `src/components/tv/player/TvPlayerModal.tsx` | Share icon button | Resolves short URL for `/tv?play=[id]` and triggers share or copy. |
| **Sport Events & League** | `src/components/map/panels/EventPanel.tsx` | ShareActions component | Inherits short link generation and QR enhancement via `ShareActions`. |
| **Challenge Games** | `ChallengeStartCountdownDialog.tsx` & `header-parts.tsx` | ShareActions component | Shares crew code and short join link `/games/join/[code]`. |

---

## 8. Verification & Test Suite

### 8.1 Automated Test Coverage
- **`src/lib/utils/short-code.test.ts`**:
  - Base62 format correctness, entropy distribution, length bounds.
  - URL normalization (same-origin extraction, trailing slash, query parameters).
  - Open redirect blocking and protocol validation.
- **`src/lib/repositories/short-link/drizzle-short-link-repository.test.ts`**:
  - Repository mock DB chain for `findByCode`, `findByTargetUrl`, `create`.
- **`src/lib/services/short-link/short-links.test.ts`**:
  - Cache integration, format helpers, target URL deduplication, collision retry handling.
- **`src/app/api/short-links/route.test.ts`**:
  - POST payload parsing, Zod validation, origin detection, error responses.
- **`src/app/s/[code]/route.test.ts`**:
  - 307 redirect responses, location headers, `Cache-Control` header presence, 404/expired handling.
- **`src/proxy.test.ts`**:
  - Rate limit tier matching for `/api/short-links`.
- **`src/components/ui/ShareActions.test.tsx`**:
  - UI rendering, initial fallback, short URL upgrade, QR code SVG value propagation, clipboard copy.

### 8.2 Execution Command
```bash
node ./node_modules/vitest/vitest.mjs run \
  src/lib/utils/short-code.test.ts \
  src/lib/repositories/short-link/drizzle-short-link-repository.test.ts \
  src/lib/services/short-link/short-links.test.ts \
  src/app/api/short-links/route.test.ts \
  src/app/s/\[code\]/route.test.ts \
  src/proxy.test.ts \
  src/components/ui/ShareActions.test.tsx
```
