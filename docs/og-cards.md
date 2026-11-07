# Share images (OG cards)

When someone shares an OpenSpot link on WhatsApp, iMessage, X, LinkedIn, Facebook or Slack, the platform shows the page's Open Graph image. Some of those images are drawn by the app per entity. The rest are fixed PNGs designed in a local card sheet, `design/og-cards/`. This doc explains both, how to use the sheet, and how to grow it.

## Two kinds of share image

| Kind | Who draws it | Where |
| --- | --- | --- |
| **Generated, per entity** | The app, at request time | Spots (`src/app/spots/[id]/opengraph-image.tsx`, plus the spot's own photo in metadata), TV videos (YouTube thumbnail via `resolveTvOgImage` in `src/lib/tv/share.ts`), contest covers (`src/app/league/[slug]/opengraph-image.tsx`), per-rider result cards (`src/app/league/[slug]/r/[userId]/opengraph-image.tsx`), games and game invites (`src/app/games/[id]/opengraph-image.tsx`, `src/app/games/join/[shareCode]/opengraph-image.tsx`). Helpers are in `src/lib/og/`. |
| **Static, per section** | The card sheet, exported once | `design/og-cards/`. The PNGs go into `public/`, and a route's `metadata` points at them. |

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

| id | File | Meant for |
| --- | --- | --- |
| `default` | `og-default.png` | Every page without its own image (root `layout.tsx`). |
| `tv` | `og-tv.png` | `/tv` landing. Each video keeps its own thumbnail. |
| `league` | `og-league.png` | `/league` landing. |
| `games-training` | `og-games-training.png` | Training games. |
| `games-battle` | `og-games-battle.png` | Battle (challenge mode) games. |
| `league-results` | `og-league-results.png` | A contest that has ended / published results. |
| `games-results` | `og-games-results.png` | A game that has ended. |
| `rider` | `og-rider.png` | Rider profile (generic, no personal data). |
| `curator` | `og-data-curator.png` | `/support/data-curator` invitation. |

### Using it

- **Export everything:** run `design/og-cards/export.sh` (needs Google Chrome and `python3`). It serves the folder on `127.0.0.1:4179`, opens `index.html?only=<id>` for each card, and writes `design/og-cards/out/<file>.png`. Override the Chrome path with `CHROME=…` and the port with `PORT=…`.
- **Look at the sheet:** open `index.html` in a browser, or start the `og-cards` preview server in `.claude/launch.json` (port 4178). Opening the file directly works in Chrome and Safari. Previews that turn the page into a `data:` URL break the relative `assets/` paths, so use the server there.
- **One card:** `index.html?only=league` shows only that card, flush at 0,0.
- **Safe zone:** the checkbox at the top outlines the central 1000×520. Keep the logo and text inside it: WhatsApp and iMessage crop to a near-square, and X crops the edges.
- **By hand:** DevTools → select the `<section>` → Cmd+Shift+P → *Capture node screenshot*. On a Retina screen this gives 2400×1260. Downscale with `sips -z 630 1200 file.png`, or set DPR 1 in the device toolbar first.

## Shipping a card

1. Export, then copy the PNG into `public/`. Use a **new filename** whenever the design changes (for example `og-league-v2.png`). Platforms cache share images by URL, often for weeks, and many ignore query strings, so renaming is the only reliable cache-buster.
2. Point the route's metadata at it, with explicit size and alt text, in both `openGraph` and `twitter`:

   ```ts
   export const metadata: Metadata = {
     openGraph: { images: [{ url: "/og-league.png", width: 1200, height: 630, alt: "OpenSpot League contests" }] },
     twitter: { card: "summary_large_image", images: ["/og-league.png"] },
   };
   ```

   `metadataBase` (`src/app/layout.tsx`, from `env.APP_URL`) turns the relative path into an absolute URL. Pages and layouts only, following the existing pattern: `src/app/tv/page.tsx`, `src/app/games/layout.tsx`.
3. A route with its own `opengraph-image.tsx` file wins over `metadata.openGraph.images`. Remove the file convention for routes that should use a static PNG.
4. Keep each PNG small: under about 300 KB is a good target (WhatsApp drops images over about 600 KB without warning). Run it through an optimizer if the export is larger.
5. Deploy, then re-scrape the URL in the Facebook Sharing Debugger and LinkedIn Post Inspector. X and WhatsApp refresh on their own schedule; a new filename is what makes them pick up the change.

`public/` is served by Workers static assets, so the PNGs need no code to serve, but they are **not on disk at runtime**. A generated image that needs one goes through `loadPublicImageAsDataUrl` (`src/lib/og/images.ts`).

## Scaling

### Adding a static card

1. In `index.html`, copy an existing `<div class="item">…</div>` block and give its `<section>` a new, unique `id`.
2. Reuse a wash class (`wash-default`, `wash-tv`, `wash-league`, `wash-training`, `wash-battle`, `wash-profile`, `wash-support`) or add one next to them. Follow the one-wash-per-route rule in `AGENTS.md`: a card's wash matches the route it represents.
3. Keep the shared layout (`.inner` grid, `.eyebrow`, `h2`, `.sub`, `.foot`) so cards look like a set. Two-line titles at 66px fit. If a title wraps to three lines, shorten the copy rather than shrinking the font.
4. Add `"<id>:<file>.png"` to `CARDS` in `export.sh` and a row to the tables here and in the README.

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

## Known debt

The cards in the sheet replace these. Clear them when the new PNGs are wired in:

- `public/opengraph.png` is 2239×1188 but is declared as 1200×630 in `src/app/layout.tsx`.
- `public/opengrapgh-tv.png` is misspelled and 1140×470 (`src/lib/tv/share.ts`).
- The root `src/app/opengraph-image.tsx` only wraps `opengraph.png`. Once the root metadata points at `og-default.png`, remove it, or it will keep winning.
- `src/app/games/layout.tsx` uses the square `challenges.jpg` with no width or height set.
