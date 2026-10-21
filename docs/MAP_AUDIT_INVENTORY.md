# Comprehensive Map Audit & Technical Debt Inventory
**Route:** `https://www.openspotleague.com/map` (`/map`)  
**Audit Date:** October 2026  
**Auditor:** Autonomous QA & Senior Systems Inspector (Live Browser DevTools + Codebase Cross-Analysis)

---

## 1. Executive Summary

A comprehensive live runtime inspection and static codebase analysis of `https://www.openspotleague.com/map` was conducted using Chrome DevTools automated browser testing combined with AST and module dependency tracing across the repository.

While the map delivers high-fidelity monochrome styling, deep keyboard accessibility, and offline/resilience handling via `withSafeDefault`, the audit uncovered **critical production failure modes**, **catastrophic latent security blocks**, **abandoned dead components**, and **severe marker/UI collisions** that degrade stability and user experience.

### Key Severity Overview
| Category | Critical (P0) | High (P1) | Medium (P2) | Low / Debt (P3) |
| :--- | :---: | :---: | :---: | :---: |
| **Stability & Performance** | 1 | 2 | 1 | 0 |
| **Security & Headers** | 1 | 0 | 1 | 0 |
| **Visual & Layout Collisions** | 0 | 2 | 1 | 0 |
| **UX & Interaction** | 0 | 2 | 3 | 1 |
| **Dead Code & Tech Debt** | 0 | 1 | 3 | 3 |

---

## 2. Critical Production Bugs & Stability Crashes (P0 / P1)

### 2.1 [CRITICAL - P0] SSR Flight Stream Closure: `Error: Connection closed.` (500 / GlobalError / Route Error)
* **Observed Live Behavior:**  
  Navigating to `https://www.openspotleague.com/map` or accessing filtered country routes (e.g. `?country=united-states&city=new-york&region=north-america`) repeatedly fails with a browser navigation timeout (>10,000ms), followed by:
  ```
  [error] Error: Connection closed.
  [error] {"timestamp":"...","level":"error","event":"Route error boundary caught","message":"Connection closed."}
  ```
  The user is presented with the fallback error UI (`SOMETHING WENT WRONG` / `CRITICAL ERROR` with "TRY AGAIN" button).
* **Code Trace:**
  - `src/app/map/page.tsx` (`MapCountryScope` -> `loadCountryScope` -> `listSpotsForMapScope`)
  - `src/lib/services/spot/map-country.ts` (`runListSpotsForMapScope`)
* **Root Cause:**
  `runListSpotsForMapScope` executes an unbounded sequential loop over database pagination:
  ```ts
  for (let page = 0; page < MAP_COUNTRY_MAX_PAGES; page++) {
    const result = await listPage({
      country,
      city: citySlug ?? undefined,
      limit: SPOT_LIST_HARD_CAP, // 500
      cursor: cursor ?? undefined,
    });
    items.push(...result.items);
    if (!result.nextCursor) return items;
    cursor = result.nextCursor;
  }
  ```
  For large catalogs such as the United States (5.8K+ spots), this performs up to 12 sequential network round-trips to Postgres via the Supabase pooler inside the Next.js Server Component streaming pipeline. When this exceeds the server/edge execution timeout (10–15s), the HTTP response stream is aborted mid-chunk. The browser's React flight parser receives an unexpected EOF and throws `Error: Connection closed.`.
* **Remediation:**
  1. Never run sequential multi-page cursor loops in the SSR critical render path.
  2. Implement a single indexed query returning lightweight map projections (`id, lat, lon, name, slug, type, sports`) capped or binned by spatial bounding boxes/geohash tiles.
  3. Decouple country-wide spot loading from initial page SSR: render the map shell immediately and stream or client-fetch the country dataset in chunks or vector tiles.

---

### 2.2 [CRITICAL - P0] Latent Map Tile Outage: Missing OpenStreetMap Origin in CSP `img-src`
* **Observed Live Behavior:**  
  Chrome DevTools logged 50+ violations per session:
  ```
  [info] Loading the image 'https://b.tile.openstreetmap.org/2/0/1.png' violates the following Content Security Policy directive:
  "img-src 'self' data: blob: https://lh3.googleusercontent.com https://i.ytimg.com https://spots.cdn.openspotleague.com https://events.cdn.openspotleague.com"
  ```
* **Code Trace:**
  - `src/lib/security/headers.ts` (line 19)
  - `next.config.mjs` (line 41)
* **Root Cause:**
  Both security header configurations define:
  ```ts
  `img-src 'self' data: blob: https://lh3.googleusercontent.com https://i.ytimg.com https://spots.cdn.openspotleague.com https://events.cdn.openspotleague.com`
  ```
  Neither includes `https://*.tile.openstreetmap.org`. The only reason map tiles render today is because the header is currently set to `Content-Security-Policy-Report-Only`.
* **Impact:**
  The second this policy is enforced as `Content-Security-Policy`, **every map tile will be blocked by the browser**, completely breaking the core feature of the website.
* **Remediation:**
  Add `https://*.tile.openstreetmap.org` to `img-src` in both `src/lib/security/headers.ts` and `next.config.mjs`. Also allow Cloudflare web analytics (`https://static.cloudflareinsights.com`) in `script-src` to resolve the secondary CSP violation.

---

## 3. Visual, Spatial & Interaction Collisions (P1 / P2)

### 3.1 [HIGH - P1] Marker Stacking & Event Interception at Zoom > 6 (Zero Spiderfy / Clustering)
* **Observed Live Behavior:**  
  In dense metropolitan areas (e.g. New York, Brooklyn, Lower Manhattan), multiple spot markers render at identical or near-identical pixel coordinates.
  - Test Case: Attempting to select `Brooklyn Banks Skate spot` (`x: 700..764, y: 566..590`) consistently activates `The Pyramid Ledges spot` (`x: 681..761, y: 577..601`).
  - The DOM elements overlap completely, and the higher z-index marker (`z-index: 1528` vs `517`) intercepts all pointer/touch events.
* **Code Trace:**
  - `src/components/map/controls/LeafletCanvas.tsx` (`CLUSTER_ZOOM_MAX = 6`)
  - `src/components/map/shared/map-derived.ts` (`buildRenderedMapItems`)
* **Root Cause:**
  Marker clustering is strictly disabled when zoom level exceeds 6:
  ```ts
  const CLUSTER_ZOOM_MAX = 6;
  ```
  At city/neighborhood zoom levels (zooms 7 through 14), 80+ markers in a city are rendered as discrete DOM elements. Leaflet does not implement a spiderfy or spiral expansion algorithm on overlapping pins, making occluded markers impossible to tap or click.
* **Remediation:**
  1. Increase clustering threshold or implement a distance-based declutter / spiderfy mechanism (e.g., `leaflet.markercluster` or a lightweight canvas/SVG spiderfy on click).
  2. Implement offset grouping for co-located spots.

---

### 3.2 [HIGH - P1] Broken Spot Focus Deep Link: "View on Map" Drops the Spot Target
* **Observed Live Behavior:**  
  From any spot detail page (e.g. `/spots/0135d30d-cea4-50ad-9c63-fe7ec11428d8`), clicking the **"View on map"** button navigates to:
  ```
  /map?country=united-states&city=new-york&region=north-america
  ```
  The map opens at the city level, but **does not focus, zoom to, or open the spot details card** for the spot the user was just looking at.
* **Code Trace:**
  - `src/lib/spots/back-to-map.ts` (`buildBackToMapUrl`):
    ```ts
    export function buildBackToMapUrl(spot: Spot, regions?: readonly Region[]): string {
      const next = new URLSearchParams();
      const countrySlug = slugify(spot.country);
      if (countrySlug) next.set("country", countrySlug);
      if (spot.citySlug) next.set("city", spot.citySlug);
      if (regions) {
        const region = findRegionForCountry(spot.country, regions);
        if (region) next.set("region", slugify(region.name));
      }
      const query = next.toString();
      return query ? `${ROUTES.map}?${query}` : ROUTES.map;
    }
    ```
  - Meanwhile, `src/components/map/layout/MapTab.tsx` specifically implements spot deep linking:
    ```ts
    // Focus target from "View on map" deep link: /map?country=...&spot=<id>
    const focusedSpotId = searchParams.get("spot");
    ```
* **Root Cause:**
  `buildBackToMapUrl` completely omits `next.set("spot", spot.id)`. The target spot ID is never added to the query string, causing the entire `focusedSpotId` centering and pin reveal engine in `MapTab` to remain dead.
* **Remediation:**
  Update `buildBackToMapUrl` in `src/lib/spots/back-to-map.ts` to include `next.set("spot", spot.id)`.

---

### 3.3 [MEDIUM - P2] Mobile Viewport Collision: Spot Card Occludes Scope Pill & Crowds Navigation
* **Observed Live Behavior (Mobile Viewport 390x844):**
  - When a spot pin is tapped, `MapInfoPopup` mounts at the bottom:
    `popupRect: { x: 0, y: 542, width: 390, height: 230, bottom: 772 }`
  - The map scope pill (`NEW YORK, UNITED STATES`) is positioned at:
    `scopePillRect: { x: 12, y: 723, width: 181.9, height: 33, bottom: 756 }`
  - The bottom navigation bar is at:
    `bottomNavRect: { y: 778..834, height: 56 }`
* **Impact:**
  The popup card completely covers and collides with the scope pill on mobile devices. The user sees clipping or text partially occluded behind translucent card backdrops. Furthermore, with the top bar (64px) + controls (46px) + popup (230px) + bottom navigation (56px), only ~250px of visible map remains interactive.
* **Remediation:**
  1. Hide or shift the scope pill (`scopeLabel`) when `activePinId` is not null.
  2. Implement an expandable peek/half-sheet drawer for mobile spot cards instead of a fixed bottom card.

---

## 4. UX Weaknesses & Cognitive Friction

### 4.1 Strict Geo-Gating Blocks Exploratory Browsing
* **Behavior:**  
  When an anonymous user visits `/map` for the first time without URL parameters or stored preferences, they are blocked by a mandatory full-screen gate:
  `"Region & country required - Filtered mode needs both a region and a country. Choose your area to load the map."`
  The Search Overlay modal automatically forces itself open.
* **Friction:**  
  Users cannot simply zoom around the global map or explore continents interactively without committing to a rigid 3-step hierarchy (Region -> Country -> City).

### 4.2 Missing Spot Type & Discipline Filters in Map Controls
* **Behavior:**  
  The map controls toolbar only allows switching between `FILTERED`, `NEARBY`, and `SAVED`. There are **no controls to filter by spot type** (e.g. Street, Plaza, DIY, Skatepark, Bowl) or **discipline** (Skateboard, BMX, Inline/Roller, Scooter).
* **Friction:**  
  BMX riders or rollerbladers looking only for bowls or DIYs cannot filter on the map interface. `preferredSport` only filters if set in global user account preferences.

### 4.3 Confusing "Verify Weather" Flow in Map Details Popup
* **Behavior:**  
  Inside the spot details card popup, a prominent button with a cloud icon is labeled `Verify weather`.
  When clicked, it opens a modal asking `"IS THE FORECAST CORRECT RIGHT NOW? [YES, CORRECT] / [NO, DIFFERENT]"`.
  When a remote user taps `[VERIFY]`, it rejects with an error toast:
  `[ ERR ] Share location to verify weather` or `Move closer — you're 4000 km away`.
* **Friction:**  
  Users expect this button to refresh or display detailed live weather forecasts. Instead, it is a crowdsourced data-verification tool restricted to users physically at the spot (<250m). The CTA copy should be "Confirm weather on-site" or moved into a secondary tab.

### 4.4 SAVED Mode Missing Empty State
* **Behavior:**  
  When selecting the `SAVED` tab on a profile with no saved spots, the map clears all markers and shows a blank tile grid with **no empty state callout, helper banner, or link to bookmark spots**.

### 4.5 Missing Map Zoom Controls on Desktop
* **Behavior:**  
  Leaflet's `<ZoomControl position="topright" />` is commented out in `LeafletCanvas.tsx`. Desktop users on non-trackpad setups or users with accessibility needs have no visual buttons to zoom in/out.

### 4.6 Search Modal Navigates Away from Map
* **Behavior:**  
  When searching for a spot name (e.g. "brooklyn") in the search overlay while on `/map`, clicking the spot navigates away to `/spots/[id]` instead of panning and selecting the pin on the map canvas.

### 4.7 Fake Drag Handle on Mobile Bottom Sheet
* **Behavior:**  
  `#map-info-popup` displays a rounded horizontal gray pill handle at the top, mimicking an iOS bottom sheet. However, there are no touch gesture handlers (`touchstart`/`touchmove`/`touchend` or drag animation) implemented; dragging down does nothing.

---

## 5. Dead Code, Unmounted Components & Deprecated Shims

The codebase contains significant remnants of abandoned refactors and dead components within `src/components/map/`:

| Component / File | Status | Notes |
| :--- | :--- | :--- |
| `src/components/map/layout/MapSidebar.tsx` | **100% Dead Code** | 300+ lines; only imported by `MapSidebarDrawer.tsx`, which itself is unmounted. |
| `src/components/map/layout/MapSidebarDrawer.tsx` | **100% Dead Code** | Never imported anywhere in the application. |
| `src/components/map/layout/MapShell.tsx` | **Deprecated & Unused** | Deprecated shim marked as consolidated into `AppShell`. |
| `src/components/map/controls/CheckDistance.tsx` | **Dead Code** | Commented out in `MapControls.tsx` (lines 5, 30); only imported by its own test. |
| `src/components/map/controls/ToggleWeather.tsx` | **Dead Code** | Commented out in `MapControls.tsx` (lines 6, 31). |
| `src/components/map/markers/LayerToggle.tsx` | **Ghost Component** | Wrapped in `<div className="hidden">` in `MapControls.tsx`; "Events" option is commented out; button is disabled with only 1 option. Continues to mount and execute in background. |
| `useMapStore.isWeatherEnabled` | **Dead Store State** | `setWeatherEnabled(true)` is never invoked anywhere; weather on markers is permanently disabled in production. |
| `src/lib/map-last-filter.ts` | **Deprecated Shim** | Re-exports `@/lib/map/last-filter`. Zero callers remaining in `src/`. |
| `src/lib/map-preserve.ts` | **Deprecated Shim** | Re-exports `@/lib/map/preserve`. Zero callers remaining in `src/`. |
| `src/lib/repositories/db-error-map.ts` | **Deprecated Shim** | Re-exports `@/lib/repositories/core/db-error-map`. Zero callers remaining in `src/`. |

---

## 6. Performance & Architectural Anti-Patterns

1. **Sequential Database Pagination in SSR:**  
   `runListSpotsForMapScope` calls `await listPage(...)` up to 20 times sequentially. A single query with `where country = $1` returning slim projections would complete in a single round-trip (<100ms) instead of taking up to 15,000ms.
2. **Prop Drilling of Unused Callbacks:**  
   In `MapTab.tsx`:
   ```tsx
   const [isSidebarOpen, setIsSidebarOpen] = useState(false);
   <MapControls isSidebarOpen={isSidebarOpen} onSidebarOpenChange={setIsSidebarOpen} ... />
   ```
   In `MapControls.tsx`:
   `isSidebarOpen` and `onSidebarOpenChange` are accepted in `MapControlsProps` but completely ignored in the component body.
3. **Double Store Mirroring in Layout Effects:**  
   In `MapPageClient.tsx`:
   ```tsx
   useLayoutEffect(() => {
     setCountrySpots(countrySpots);
     setCitySpots(deriveScopeCitySpots(countrySpots, citySpots, cityParam));
     setCityScopeLoading(false);
   }, [...]);
   ```
   RSC flight data is mirrored into global Zustand store slices on every parameter change before paint, causing dual reactive state trees (URL searchParams vs Zustand stores) that can fall out of sync during fast navigation.

---

## 7. Actionable Improvement Roadmap

### Tier 1: Immediate Production Hotfixes (Next Deploy)
1. **Fix CSP Tile Blocking:**
   Add `https://*.tile.openstreetmap.org` and `https://static.cloudflareinsights.com` to `src/lib/security/headers.ts` and `next.config.mjs`.
2. **Fix Spot Deep Linking ("View on map"):**
   Update `buildBackToMapUrl` in `src/lib/spots/back-to-map.ts` to append `next.set("spot", spot.id)`.
3. **Fix SSR Connection Drop / Query Serialization:**
   Replace the 20-page sequential `listSpotsForMapScope` loop with a single direct SQL/Drizzle query for map scope or fetch spot pins on client side via SWR/React Query.

### Tier 2: Cleanup & Dead Code Removal (Refactor)
1. Delete unused dead files:
   - `src/components/map/layout/MapSidebar.tsx`
   - `src/components/map/layout/MapSidebarDrawer.tsx`
   - `src/components/map/layout/MapShell.tsx`
   - `src/components/map/controls/CheckDistance.tsx` & test
   - `src/components/map/controls/ToggleWeather.tsx`
   - `src/lib/map-last-filter.ts`
   - `src/lib/map-preserve.ts`
   - `src/lib/repositories/db-error-map.ts`
2. Remove `<div className="hidden"><LayerToggle /></div>` from `MapControls.tsx`. Either re-enable the Events toggle properly or remove the component and its hook invocation entirely.
3. Remove unused `isSidebarOpen` props and state from `MapTab.tsx` and `MapControls.tsx`.

### Tier 3: UX & Collision Enhancements
1. **Spiderfy / Overlap Handling:**
   Implement pin expansion on click for co-located spots when zoom > 6 to resolve stacking collisions like Brooklyn Banks / Pyramid Ledges.
2. **Mobile Scope Pill Collision:**
   Conditionally hide the bottom-left scope pill when `activePinId` or `activeEventId` is set.
3. **In-Map Spot Type / Discipline Filtering:**
   Add a spot type / sport discipline quick-filter chip row on the map canvas.
4. **Clarify On-Site Weather Verification:**
   Rename the popup button from "Verify weather" to "Confirm on-site" with a tooltip explaining that GPS proximity (<250m) is required.
