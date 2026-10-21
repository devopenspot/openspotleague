# Comprehensive TV Audit & Technical Debt Inventory
**Route:** `https://www.openspotleague.com/tv` (`/tv`)  
**Audit Date:** October 2026  
**Auditor:** Autonomous QA & Senior Systems Inspector (Live Browser DevTools + Codebase Cross-Analysis)

---

## 1. Executive Summary

A comprehensive live runtime inspection and static codebase analysis of `https://www.openspotleague.com/tv` was conducted using Chrome DevTools automated browser testing combined with AST and module dependency tracing across the repository (`src/app/tv`, `src/components/tv`, `src/lib/services/tv`, `src/lib/repositories/tv`, and related APIs).

OpenSpot TV delivers a high-speed, dark-themed streaming catalog and "Theater Mode" (`TvPlayerModal`) designed for action sports (BMX, Skateboard, Roller, Scooter). It features server-rendered category marquees, deep-linking with `replaceState`, keyset-paginated rows, and YouTube Iframe API ended-state detection.

However, the audit revealed **critical autoplay sound blocking by modern browsers**, **jarring onboarding interruptions for anonymous visitors**, **distorted vertical cropping of 16:9 thumbnails**, **double-counting collisions in total video tallies**, and **latent dead code/architecture debt** that degrade user experience and system maintainability.

### Severity Overview
| Category | Critical (P0) | High (P1) | Medium (P2) | Low / Debt (P3) |
| :--- | :---: | :---: | :---: | :---: |
| **UX & Video Playback** | 1 | 2 | 2 | 1 |
| **Visual & Layout Design** | 0 | 2 | 2 | 0 |
| **Collisions & Inconsistencies** | 0 | 2 | 1 | 1 |
| **Performance & Architecture** | 0 | 1 | 2 | 1 |
| **Dead Code & Tech Debt** | 0 | 0 | 3 | 2 |

---

## 2. UX & Video Playback Failures (P0 / P1)

### 2.1 [CRITICAL - P0] Autoplay Sound Policy Block & Missing Audio Controls
* **Observed Live Behavior:**  
  When a user clicks "Autoplay BMX" or opens a video card from `/tv`, `toAutoplayEmbedUrl` outputs `autoplay=1&mute=0`. In modern browsers (Google Chrome, macOS Safari, iOS Safari, Microsoft Edge), unmuted media autoplay without a high domain Media Engagement Index (MEI) is **strictly blocked**.
  Consequently, playback is either frozen on the initial frame or YouTube silently forces the player into a muted state.
* **Code Trace:**
  - `src/components/tv/grid/TvGrid.tsx` (lines 56–64):
    ```ts
    const [muted] = useState<boolean>(() => {
      if (typeof window === "undefined") return false;
      try {
        const stored = window.localStorage.getItem(MUTED_KEY);
        return stored === null ? false : stored === "1";
      } catch {
        return false;
      }
    });
    ```
  - `src/lib/tv/embed.ts` (lines 6–13):
    ```ts
    export function toAutoplayEmbedUrl(embedUrl: string, opts: { autoplay?: boolean; muted?: boolean; ... } = {}) {
      const { autoplay = true, muted = true, ... } = opts;
      url.searchParams.set("autoplay", autoplay ? "1" : "0");
      url.searchParams.set("mute", muted ? "1" : "0");
    ```
* **Compounding Flaw:**
  - `TvGrid.tsx` declares `const [muted] = useState(...)` with **no setter**.
  - `MUTED_KEY = "tv:muted"` is never written to anywhere in the codebase.
  - `TvPlayerModal.tsx` top control bar contains Next, Previous, Auto/Manual, Share, and Close, but **zero volume or mute/unmute buttons**. The user is left wondering why there is no audio and is forced to click tiny native YouTube controls inside the iframe.
* **Remediation:**
  1. Default initial playback to muted (`mute=1`) to guarantee 100% reliable autoplay across all browsers and operating systems.
  2. Add an explicit "Unmute" pill/button in the top control bar of `TvPlayerModal` (or an overlay button over the video stage) that sends the unMute postMessage command to the YouTube iframe API:
     ```ts
     iframeRef.current?.contentWindow?.postMessage(
       JSON.stringify({ event: "command", func: "unMute" }),
       "*"
     );
     ```
  3. Provide `setMuted` in `TvGrid` and persist the user's preference to `localStorage.setItem(MUTED_KEY, ...)`.

---

### 2.2 [HIGH - P1] Intrusive Onboarding Modal Hijacks Anonymous TV Visitors
* **Observed Live Behavior:**  
  When an anonymous user visits `https://www.openspotleague.com/tv` to watch action sports videos, the global onboarding modal prompt (`openOnboarding("onboarding")`) automatically triggers and covers the screen.
  If the user enters via a shared video link (`/tv?play=<uuid>`), the prompt is temporarily deferred, but the exact millisecond they close the theater player modal, the onboarding dialog aggressively pops up.
* **Code Trace:**
  - `src/components/tv/grid/use-tv-discipline-state.ts` (lines 204–242):
    ```ts
    // Onboarding prompt on first visit
    useEffect(() => {
      if (onboardingPromptedRef.current) return;
      if (hydrationStatus !== "ready" && hydrationStatus !== "error") return;
      if (preferredSport) {
        onboardingPromptedRef.current = true;
        return;
      }
      if (playParam) {
        deferredOnboardingRef.current = true;
        return;
      }
      openOnboarding("onboarding");
    }, [...]);

    const checkDeferredOnboarding = useCallback(() => {
      if (deferredOnboardingRef.current) {
        ...
        useUIStore.getState().openOnboarding("onboarding");
      }
    }, []);
    ```
* **Root Cause & UX Impact:**
  TV is a passive media viewing feature. Users arriving from social shares (Twitter, Instagram, WhatsApp) want to watch the clip, not be forced through an app onboarding flow. This creates high bounce rates.
* **Remediation:**
  Remove automated `openOnboarding("onboarding")` invocation from the TV route. Let the discipline selector pills (`ALL`, `BMX`, `SKATEBOARD`, etc.) serve as the natural, non-intrusive sport switcher.

---

### 2.3 [HIGH - P1] Cross-Origin Iframe Swallows Mobile Touch Navigation Swipes
* **Observed Live Behavior:**  
  `TvPlayerModal` advertises horizontal touch swiping to navigate to the Next/Previous video. However, on mobile devices, the YouTube `<iframe>` occupies >90% of the stage. Swiping across the video does not trigger navigation.
* **Code Trace:**
  - `src/components/tv/player/TvPlayerModal.tsx` (lines 416–420):
    ```tsx
    <div
      className="flex min-h-0 flex-1 touch-pan-y items-center justify-center bg-black sm:p-4 lg:p-6 landscape:p-2"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      ...
      <iframe ref={iframeRef} src={src} ... />
    </div>
    ```
* **Root Cause:**  
  Browsers do not bubble touch/mouse events out of cross-origin iframes (`youtube.com`). Touch events only fire if the user happens to swipe on the thin 4px–8px outer padding area around the video player.
* **Remediation:**
  1. Add visible on-screen chevron touch targets or edge overlay swipe areas that sit above the video boundaries.
  2. Display prominent Next/Prev buttons in mobile portrait orientation under the stage.

---

## 3. Visual & Layout Weaknesses (P1 / P2)

### 3.1 [HIGH - P1] Vertical Aspect Ratio (`32vh`) Severely Crops 16:9 YouTube Thumbnails
* **Observed Live Behavior:**  
  In the catalog marquees, cards have fixed widths (`w-[208px] sm:w-[232px]`) paired with `h-[32vh]`.
  On a standard 1080p desktop monitor, `32vh` equals ~345px height. This forces the card into a **tall portrait aspect ratio (approx. 2:3)**.
  Because YouTube video thumbnails are standard **16:9 widescreen horizontal rectangles**, applying `object-cover` crops off **over 55% of the thumbnail image** on the left and right sides.
* **Code Trace:**
  - `src/components/tv/marquee/TvMarqueeCard.tsx` (lines 61–65):
    ```tsx
    className="group/card flex w-[208px] shrink-0 flex-col overflow-hidden rounded-[14px] border bg-wire-border ... sm:w-[232px]"
    ...
    <div className="relative h-[32vh] w-full overflow-hidden bg-wire-border flex items-center justify-center">
      <CardImage item={item} />
    ```
  - `src/lib/tv/urls.ts` (lines 52):
    ```ts
    return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    ```
* **Compounding Flaw:**  
  YouTube serves `hqdefault.jpg` in a 4:3 canvas with baked-in black letterbox bars at top and bottom. When a 4:3 letterboxed thumbnail is loaded into a vertical `32vh` card with `object-cover`, the resulting view is aggressively cropped, amputating riders, trick names, and video graphics.
* **Remediation:**
  1. Base card dimensions on a true video aspect ratio: `aspect-video` (16:9) or `aspect-[16/10]`. For example: `w-[260px] sm:w-[280px]` with `aspect-video` (height ~146px–158px).
  2. Use `mqdefault.jpg` (320x180, true 16:9 without letterboxing) or `maxresdefault.jpg` fallback instead of `hqdefault.jpg`.

---

### 3.2 [MEDIUM - P2] Overlaid 9px Typography & Extreme Title Truncation
* **Observed Live Behavior:**  
  All metadata on video cards is rendered in a microscopic `text-[9px]` font inside frosted glass pill overlays. Titles are truncated aggressively to a single line:
  `DIG X MARIUS DIETSCHE - 'HELL NA...`
  Users cannot read titles or discern video content without opening each video.
* **Code Trace:**
  - `src/components/tv/marquee/TvMarqueeCard.tsx` (lines 71–86):
    ```tsx
    <span className="... font-display text-[9px] font-bold uppercase ...">
      <span className="truncate max-w-[12ch]">{item.disciplineSlug}</span>
    </span>
    ...
    <p className="absolute bottom-0 left-0 max-w-[calc(100%-12px)] truncate ... text-[9px] ...">
      {item.title}
    </p>
    ```
* **Remediation:**
  Move title and metadata beneath the thumbnail (traditional video card layout) or provide a multi-line title area with standard readable text sizing (`text-xs` / 12px font).

---

### 3.3 [MEDIUM - P2] Missing Fullscreen Toggle in Theater Top Bar
* **Observed Live Behavior:**  
  `TvPlayerModal` operates as a theater modal, but lacks a dedicated Fullscreen toggle button. Users on TV displays, tablets, or desktop browsers must hunt for the tiny YouTube iframe native fullscreen icon in the bottom-right corner.
* **Remediation:**
  Add a `Maximize` / `Minimize` fullscreen toggle button in `TvPlayerModal` top bar utilizing the HTML Fullscreen API (`document.documentElement.requestFullscreen()`).

---

## 4. Collisions, Race Conditions & Inconsistencies (P1 / P2)

### 4.1 [HIGH - P1] Total Count Double-Counting & Layout Shift Collision
* **Observed Live Behavior:**  
  When viewing BMX videos, the Autoplay button and theater modal header initially display **"79 videos"**.
  However, once all category rows finish loading, the total suddenly drops to **"58 videos"**.
* **Code Trace:**
  - `src/components/tv/grid/use-tv-theater-queue.ts` (lines 83–99):
    ```ts
    const totalForTheaterFilter = useMemo(() => {
      if (theaterCategory === "all") {
        const allRowsLoaded =
          categoryRows.length > 0 &&
          categoryRows.every(
            (row) => row.nextCursor === null && row.videos.length >= row.total,
          );
        if (allRowsLoaded) {
          return filtered.length;
        }
        return categoryRows.reduce((sum, row) => sum + row.total, 0);
      }
      return categoryRows.find((row) => row.category.toLowerCase() === theaterCategory.toLowerCase())?.total ?? 0;
    }, [categoryRows, theaterCategory, filtered.length]);
    ```
* **Root Cause:**  
  In the schema, `tvVideos.categories` is a string array (`string[]`). Videos frequently belong to multiple categories (e.g. `["event", "game of bike"]`).
  Summing `row.total` across categories double-counts multi-category videos (16 + 24 + 2 + 17 + 8 + 3 + 7 + 2 = 79). Once `allRowsLoaded` is met, it switches to `filtered.length` (58 unique videos), causing a jarring 21-video count drop.
* **Remediation:**
  Pass the true unique count from the server via `countTvVideos({ disciplineSlug })` or calculate distinct video IDs when computing category sums.

---

### 4.2 [HIGH - P1] Hardcoded "Roller" Discipline Sorting Override
* **Observed Live Behavior:**  
  The discipline selector pills force "ROLLER" to the front of the list, regardless of database taxonomy or alphabetical ordering.
* **Code Trace:**
  - `src/components/tv/grid/use-tv-discipline-state.ts` (lines 244–252):
    ```ts
    const sortedDisciplines = useMemo(() => {
      const copy = [...disciplines];
      const rollerIdx = copy.findIndex((d) => d.slug === "roller");
      if (rollerIdx > 0) {
        const [roller] = copy.splice(rollerIdx, 1);
        if (roller) copy.unshift(roller);
      }
      return copy;
    }, [disciplines]);
    ```
* **Technical Debt:**  
  Hardcoded arbitrary ordering logic in a client hook violates taxonomy separation of concerns. If sports are reordered in the database, this hardcoded splice mutates the order unexpectedly.
* **Remediation:**
  Rely on the sort order returned by `listSports()` from the taxonomy service.

---

### 4.3 [MEDIUM - P2] Discipline Switch Hanging Skeleton Race Condition
* **Observed Live Behavior:**  
  When clicking a discipline pill, `pendingDiscipline` triggers `TvDisciplineSwitchingSkeleton`. If the Next.js router uses a cached RSC payload where `rows` reference does not change, the skeleton hangs for up to 8,000ms until the timeout failsafe fires.
* **Code Trace:**
  - `src/components/tv/grid/use-tv-discipline-state.ts` (lines 80–93):
    ```ts
    useEffect(() => {
      if (prevRowsRef.current === rows) return;
      prevRowsRef.current = rows;
      setPendingDiscipline(null);
    }, [rows]);

    useEffect(() => {
      if (!pendingDiscipline) return;
      const t = window.setTimeout(() => setPendingDiscipline(null), 8000);
      return () => window.clearTimeout(t);
    }, [pendingDiscipline]);
    ```
* **Remediation:**
  Synchronize `pendingDiscipline` resolution with `useTransition`'s `isPending` state returned by `startTransition`.

---

### 4.4 [LOW - P3] OpenGraph Dimension Mismatch & Asset Filename Typo
* **Observed Live Behavior:**  
  OpenGraph tags generated in `TvPage` declare YouTube thumbnail images as `width: 1200, height: 630`.
  In reality, `hqdefault.jpg` is a 480x360 image. Social platforms (Twitter, Discord, iMessage) miscalculate the aspect ratio, resulting in stretched or cropped previews.
* **Code Trace:**
  - `src/lib/tv/share.ts` (lines 5, 42–47):
    ```ts
    export const TV_OG_IMAGE_PATH = "/opengrapgh-tv.png"; // Note the typo: "opengrapgh"
    ...
    return {
      url: thumb,
      width: 1200,
      height: 630,
      alt: video.title,
    };
    ```
* **Remediation:**
  1. Fix the file and constant name to `/opengraph-tv.png`.
  2. Accurately report `width: 480, height: 360` when using YouTube thumbnail URLs.

---

## 5. Performance & Architecture Bottlenecks (P1 / P2)

### 5.1 [HIGH - P1] Unbounded Queue ID Retrieval & Heavy Boundary-Walk
* **Observed Behavior:**  
  When a user navigates Next/Previous past currently loaded videos, `useTvTheaterQueue` fetches the complete list of all video IDs in the catalog from `/api/tv/ids`.
* **Code Trace:**
  - `src/app/api/tv/ids/route.ts` & `src/lib/repositories/tv/drizzle-tv-repository.ts` (lines 411–427):
    `listTvIdList` selects up to 500 IDs and returns them in a single array.
  - `src/components/tv/grid/use-tv-theater-queue.ts` (lines 190–240):
    Loops through the ID array in chunks of 10, firing sequential `/api/tv?ids=...` requests.
* **Performance Impact:**  
  Transferring and in-memory searching arrays of hundreds of IDs is fragile and introduces latency spikes during video skipping.
* **Remediation:**
  Implement a lightweight cursor-based neighbor endpoint:  
  `/api/tv/adjacent?id=<uuid>&dir=next&discipline=...` returning only the immediate target video.

---

### 5.2 [MEDIUM - P2] Lateral Unnest with Window Functions in Category Query
* **Observed Behavior:**  
  `listCategoryRows` runs a Postgres `cross join lateral unnest(tv_videos.categories)` with `count(*) over (partition by cat.category)` and `row_number() over (partition by cat.category ...)`.
* **Code Trace:**
  - `src/lib/repositories/tv/drizzle-tv-repository.ts` (lines 200–225).
* **Architecture Debt:**  
  While replacing N sequential category queries with 1 windowed query is efficient for small datasets, unnesting arrays without an inverted GIN index (`gin(categories)`) causes sequential table scans as video volume increases.
* **Remediation:**
  Ensure a GIN index on `tv_videos(categories)` exists in the database schema.

---

### 5.3 [MEDIUM - P2] Overly Coarse Cache Revalidation Scope
* **Observed Behavior:**  
  When any single video is created, updated, or deleted, `revalidateTvPaths` invalidates the global `"tv:list"` cache tag and revalidates `/tv`, `/admin/tv`, and `/`.
* **Code Trace:**
  - `src/lib/services/tv/tv.ts` (lines 275–285).
* **Remediation:**
  Scope cache tags by discipline (e.g. `tv:list:${disciplineSlug}`) to avoid invalidating the entire multi-sport catalog when a single video is edited.

---

## 6. Dead Code & Technical Debt Inventory (P3)

| File | Item | Status | Action |
| :--- | :--- | :--- | :--- |
| `src/components/tv/grid/TvGrid.tsx` | `const MUTED_KEY = "tv:muted"` | Dead key, read-only | Implement mute toggle or remove unused local storage read |
| `src/components/tv/grid/TvGrid.tsx` | `disciplineCounts?: Readonly<Record<string, number>>` | Unused prop | Remove from interface and component props |
| `src/app/tv/layout.tsx` | `// import { HeaderImageOverride } ...` | Commented out dead code | Remove commented lines; audit `public/osl-tv.png` (249 KB) |
| `src/components/tv/grid/use-tv-catalog-state.ts` | `export interface TvCategoryRowState` | Unused exported interface | Remove or integrate with hook return type |
| `src/lib/tv/share.ts` & `public/` | `opengrapgh-tv.png` | Typo in filename & constant | Rename to `opengraph-tv.png` across public assets and imports |
| `src/types/tv.ts` | `TV_CARD_BATCH_MAX = 10` vs `ROW_PAGE_LIMIT = 12` | Inconsistent batch limits | Standardize pagination constants |

---

## 7. Recommended Action Plan & Prioritization

### Milestone 1: Playback Stability & Critical UX (Day 1)
- [ ] Fix autoplay: Default `mute=1` in `toAutoplayEmbedUrl` and add an explicit "Unmute" CTA button in `TvPlayerModal`.
- [ ] Disable automatic `openOnboarding("onboarding")` trigger on `/tv` route.
- [ ] Add Fullscreen toggle button to `TvPlayerModal`.

### Milestone 2: Visual Layout & Card Design (Day 2)
- [ ] Replace `h-[32vh]` vertical card boxes with widescreen `aspect-video` (16:9) containers.
- [ ] Switch YouTube thumbnail source from `hqdefault.jpg` (4:3 letterboxed) to `mqdefault.jpg` (16:9 widescreen).
- [ ] Increase font size from 9px to minimum 12px (`text-xs`) and provide readable title wrapping.

### Milestone 3: Logic Fixes & Tech Debt Cleanup (Day 3)
- [ ] Fix total video count calculation in `use-tv-theater-queue.ts` to deduplicate multi-category videos.
- [ ] Remove hardcoded "roller" sorting in `use-tv-discipline-state.ts`.
- [ ] Clean up dead code (`disciplineCounts`, commented out layout imports, unused `TvCategoryRowState`).
- [ ] Rename `opengrapgh-tv.png` to `opengraph-tv.png`.
