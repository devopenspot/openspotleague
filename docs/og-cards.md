# Share images (OG cards)

When someone shares an OpenSpot link on WhatsApp, iMessage, X, LinkedIn, Facebook or Slack, the platform shows the page's Open Graph image. Some of those images are drawn by the app per entity. The rest are fixed PNGs designed in a local card sheet, `design/og-cards/`. This doc explains both, how to use the sheet, and how to grow it.

## Two kinds of share image

| Kind | Who draws it | Where |
| --- | --- | --- |
| **Generated, per entity** | The app, at request time | Spots (`src/app/spots/[id]/opengraph-image.tsx`, plus the spot's own photo in metadata), TV videos (YouTube thumbnail via `resolveTvOgImage` in `src/lib/tv/share.ts`), contest covers (`src/app/league/[slug]/opengraph-image.tsx`), per-rider result cards (`src/app/league/[slug]/r/[userId]/opengraph-image.tsx`), games and game invites (`src/app/games/[id]/opengraph-image.tsx`, `src/app/games/join/[shareCode]/opengraph-image.tsx`). Helpers are in `src/lib/og/`. |
| **Static, per section** | The card sheet, exported once | `design/og-cards/` → PNGs in `public/og/`, paths in `OG_IMAGES` (`src/lib/og/config.ts`), referenced from route `metadata` and as the base of the generated images above. |

Leave the generated images alone when you change the sheet. The sheet only owns the static ones.

## The card sheet

`design/og-cards/` is outside `src/` and `public/`. The app never builds, lints, serves or deploys it, so it stays private: it exists only in the repo.

| File | Role |
| --- | --- |
| `index.html` | All cards, one `<section class="og" id="…">` each, exactly 1200×630. Inline CSS, Plus Jakarta Sans from Google Fonts. |
| `assets/` | Copies of brand images from `public/` (`logo.png`, `osl-tv.png`, `openspotleague.jpg`, `trainings.jpg`, `challenges.jpg`). |
| `export.sh` | Renders every card to `out/<file>.png` at 1200×630 with headless Chrome. `out/` is git-ignored. |
| `README.md` | Quick reference: export steps and the card table. |

### Cards

All cards live in `public/og/`. Their paths come from `OG_IMAGES` in `src/lib/og/config.ts`; never hard-code a path.

| id | File (`public/og/`) | `OG_IMAGES` key | Wired at |
| --- | --- | --- | --- |
| `default` | `og-default.png` | `default` | Root `src/app/layout.tsx` (every page without its own image), the not-found branches of contest and game metadata, and the spot fallback via `DEFAULT_OG_IMAGE_PATH`. |
| `tv` | `og-tv.png` | `tv` | `/tv` landing through `TV_OG_IMAGE_PATH` (`src/lib/tv/share.ts`). Each video keeps its YouTube thumbnail. |
| `league` | `og-league.png` | `league` | `/league` metadata (`src/app/league/page.tsx`), and contests without a cover while upcoming or live (`contestOgCard`). |
| `games-training` | `og-games-training.png` | `gamesTraining` | `/games` (`src/app/games/layout.tsx`), and training games and invites (`gameOgCard`). |
| `games-battle` | `og-games-battle.png` | `gamesBattle` | Battle (`mode: "challenge"`) games and invites (`gameOgCard`). |
| `league-results` | `og-league-results.png` | `leagueResults` | Contests without a cover once `status` is `completed` (`contestOgCard`). |
| `games-results` | `og-games-results.png` | `gamesResults` | Any game whose `status` is `complete` (`gameOgCard`). |
| `rider` | `og-rider.png` | `rider` | Not wired: there is no public rider profile page yet. Ready for that route. |
| `curator` | `og-data-curator.png` | `curator` | `/support/data-curator` metadata (the page is `noindex`; unfurls still read OpenGraph). |

How the generated images use them:

- `src/app/games/[id]/opengraph-image.tsx` and `src/app/games/join/[shareCode]/opengraph-image.tsx` draw `gameOgCard(mode, status)` full-bleed, with `og-default` as the fallback.
- `src/app/league/[slug]/opengraph-image.tsx` draws the contest cover when it has one, otherwise `contestOgCard(status)`.
- `src/app/league/[slug]/r/[userId]/opengraph-image.tsx` (rider result) keeps its own text layout. With no contest cover it uses the League gradient, not a card, so two sets of text never stack.
- The "not found" variants of the game and contest images show `public/logo.png` above their message.

### Using it

- **Export everything:** run `design/og-cards/export.sh` (needs Google Chrome and `python3`). It serves the folder on `127.0.0.1:4179`, opens `index.html?only=<id>` for each card, and writes `design/og-cards/out/<file>.png`. Override the Chrome path with `CHROME=…` and the port with `PORT=…`.
- **Look at the sheet:** open `index.html` in a browser, or start the `og-cards` preview server in `.claude/launch.json` (port 4178). Opening the file directly works in Chrome and Safari. Previews that turn the page into a `data:` URL break the relative `assets/` paths, so use the server there.
- **One card:** `index.html?only=league` shows only that card, flush at 0,0.
- **Safe zone:** the checkbox at the top outlines the central 1000×520. Keep the logo and text inside it: WhatsApp and iMessage crop to a near-square, and X crops the edges.
- **By hand:** DevTools → select the `<section>` → Cmd+Shift+P → *Capture node screenshot*. On a Retina screen this gives 2400×1260. Downscale with `sips -z 630 1200 file.png`, or set DPR 1 in the device toolbar first.

## Shipping a card

1. Export, then copy the PNG into `public/og/`. Use a **new filename** whenever the design changes (for example `og-league-v2.png`) and update its `OG_IMAGES` entry. Platforms cache share images by URL, often for weeks, and many ignore query strings, so renaming is the only reliable cache-buster. `src/lib/og/config.test.ts` fails if an `OG_IMAGES` path has no file in `public/`.
2. Point the route's metadata at it with `ogImage()` (adds the 1200×630 size), in both `openGraph` and `twitter`:

   ```ts
   import { OG_IMAGES, ogImage } from "@/lib/og/config";

   export const metadata: Metadata = {
     openGraph: { images: [ogImage(OG_IMAGES.league, "OpenSpot League contests")] },
     twitter: { card: "summary_large_image", images: [OG_IMAGES.league] },
   };
   ```

   `metadataBase` (`src/app/layout.tsx`, from `env.APP_URL`) turns the relative path into an absolute URL. Pages and layouts only, following the existing pattern: `src/app/tv/page.tsx`, `src/app/games/layout.tsx`.
3. A route with its own `opengraph-image.tsx` file wins over `metadata.openGraph.images`. Remove the file convention for routes that should use a static PNG (the root one was removed for this reason).
4. Keep each PNG small. WhatsApp drops images over about 600 KB without warning. The flat cards export at 75–130 KB; the gradient ones (League, rider) at about 350 KB, because 256-colour optimisers band the gradients.
5. Deploy, then run `pnpm og:check` (see [Checking a deploy](#checking-a-deploy)). When it passes, re-scrape the URL in the Facebook Sharing Debugger and LinkedIn Post Inspector. X and WhatsApp refresh on their own schedule; a new filename is what makes them pick up the change.

`public/` is served by Workers static assets, so the PNGs need no code to serve, but they are **not on disk at runtime**. A generated image that needs one goes through `loadPublicImageAsDataUrl` (`src/lib/og/images.ts`).

## Checking a deploy

`pnpm og:check [baseUrl]` fetches `/`, `/tv`, `/league`, `/games` and `/support/data-curator` with a crawler user agent, reads each page's share tags, then downloads the image the way WhatsApp or Facebook would. Read-only, no database. The base URL defaults to `APP_URL` from `.env.local`; pass one to check another host (`pnpm og:check https://openspotleague.com`). It exits 1 on any failure.

Per page it checks:

- an `og:image` tag exists, is absolute https, and is on **the same host that served the page**;
- the declared size is 1200×630, and `twitter:image` matches `og:image`;
- the image downloads: the host resolves, HTTP 200, `image/png` or `image/jpeg`, under 600 KB.

The page list is `OG_CHECK_PATHS` and the logic is in `src/lib/og/check.ts` (unit-tested); the runner is `scripts/og-check.ts`. Add a path there when you wire a new static card.

### Troubleshooting: links show no image

Check in this order:

1. **The image host.** Run `pnpm og:check https://openspotleague.com`. The `og:image` URL is built from `metadataBase` = `env.APP_URL` (`src/app/layout.tsx`), so a wrong `APP_URL` breaks every share image at once, while the pages themselves look fine. This happened in November 2026: production `APP_URL` was `https://www.openspotleague.com`, but `www` had no DNS record (only the apex is attached to the Worker), so crawlers could not download any card. The fix is to keep `APP_URL` on a host the Worker serves, `APP_URL` now lives in the committed `.env.production` (docs/environments.md), so fixing it is a pull request and a release. To serve `www` too, add it as a custom domain on the `open-spot` Worker in the Cloudflare dashboard first.
2. **The file.** `curl -I <og:image URL>` must return 200 `image/png`. A 404 means the PNG is missing from `public/og/` or the deploy is old.
3. **The platform cache.** If both pass, the platform is showing a cached unfurl. Re-scrape in the Facebook Sharing Debugger. WhatsApp caches per link, so test with a link it has not seen (add `?v=2`).

## Scaling

### Adding a static card

1. In `index.html`, copy an existing `<div class="item">…</div>` block and give its `<section>` a new, unique `id`.
2. Reuse a wash class (`wash-default`, `wash-tv`, `wash-league`, `wash-training`, `wash-battle`, `wash-profile`, `wash-support`) or add one next to them. Follow the one-wash-per-route rule in `AGENTS.md`: a card's wash matches the route it represents.
3. Keep the shared layout (`.inner` grid, `.eyebrow`, `h2`, `.sub`, `.foot`) so cards look like a set. Two-line titles at 66px fit. If a title wraps to three lines, shorten the copy rather than shrinking the font.
4. Add `"<id>:<file>.png"` to `CARDS` in `export.sh`, a key to `OG_IMAGES`, and a row to the tables here and in the README.

### Brand changes

Colours are copied by hand from `DESIGN.md` / `src/app/globals.css` into the `:root` block of `index.html`, and images are copies from `public/`. When the brand changes, update both, re-export, and ship under new filenames.

### When a card needs real data

A static PNG can't show a rider's name, a contest's winner or a game's score. When a section needs that (a public rider profile, a per-game result), **don't multiply static files**. Generate the image instead:

- Add an `opengraph-image.tsx` next to the page and draw it with `ImageResponse` (`next/og`), following `src/app/league/[slug]/r/[userId]/opengraph-image.tsx`. Use the matching card in the sheet as the visual spec, and keep the static card as the fallback when data is missing.
- Reads go through services and repositories like any page (`docs/architecture.md`). Respect visibility: unlisted contests and private data must not leak into a public image.
- Load images with `fetchRemoteImageAsDataUrl` / `loadPublicImageAsDataUrl` from `src/lib/og/images.ts` (they handle timeouts, size caps and the missing `public/` on Workers).
- Fonts: every generated image uses `sans-serif` today. To match the sheet, fetch Plus Jakarta Sans (for example from Google Fonts) or bundle a `.ttf`, pass it to `ImageResponse`'s `fonts`, and cache the bytes at module level (plain data is fine across requests; see `perRequest` in `docs/architecture.md` for what is not).
- Caching: set `revalidate` on the image route, and remember that a share burst fans out to every crawler. Follow `docs/caching-and-egress.md`.
- `ImageResponse` supports flexbox only, with no CSS grid and a limited CSS subset, so the sheet's grid layout needs a flex rewrite.

### Many variants (locales, seasons, campaigns)

Don't duplicate HTML per variant. Pass the variant in the query string (`?only=league&lang=es`), read it in the small script at the bottom of `index.html` to swap the copy, and loop over the variants in `export.sh`. Name the outputs by variant (`og-league.es.png`).

## Remaining debt

- `public/opengraph.png` (2239×1188) is no longer a share image, but `AppImage`'s fallback and `DEFAULT_CONTEST_IMAGE` (`src/lib/league/cover.ts`) still use it. Leave it until those move to their own asset.
- `public/opengrapgh-tv.png` (misspelled) has no references left. Delete it after the next deploy, once crawlers have refreshed.
- `CHALLENGE_OG_IMAGE_PATH` / `TRAINING_OG_IMAGE_PATH` in `src/lib/og/config.ts` are unused; `challenges.jpg` / `trainings.jpg` are still used as artwork elsewhere.
- Contest images switch to the results card on `status === "completed"`, which comes before results are published. Use a published flag instead if `ContestEnriched` gains one.
