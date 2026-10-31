# UI Conventions

`DESIGN.md` is the full design spec (tokens, type, radii, overlay patterns). This page covers the rules most often broken in code.

## Design system

- The UI is monochrome and set in Plus Jakarta Sans.
- `--color-primary` (`#0a0a0a`) is reserved for CTAs, active nav, critical states, and the wire rail. Never use it on dark panels.
- `bg-gradient-primary` / `var(--gradient-primary)` (`#ea580c` → `#dc2626` → `#b91c1c`) is the only warm color wash. It appears only on the Home hero and the Games landing page.
- Radius: interactive controls use `radius-lg` (16px) or `full`. Rows and cards nested inside a 16px parent use `radius-inner` (14px).
- Shell chrome (header, nav, mobile drawer) shares a 64px height and the same margin alignment.

## Map palette

The maps (`LeafletCanvas`, `SpotStaticMap`, `SpotMapFallback`) use the dark `--color-map-*` tokens and `--map-tile-filter` (on `.leaflet-tile-pane` / `.map-tile-dark`). That palette applies only to the map canvas, its tiles, and on-map markers and overlays. Never apply it to surrounding layouts, headers, sidebars, drawers, or cards.

## No pulse animations

`animate-pulse` and any continuous pulse loop are banned in UI components, because they keep the GPU compositor repainting and drain battery. The only exception is transient loading UI that unmounts once data arrives: `*Skeleton.tsx`, `loading.tsx`, and Suspense fallbacks.

## Mobile inputs

Inputs, selects, and textareas must render at 16px or larger on mobile, otherwise iOS Safari auto-zooms. A global guard in `src/app/globals.css` (`@media (max-width: 639px)`, `!important`) covers existing controls. For new inputs, prefer `text-base sm:text-sm`. Never fix zoom with `maximum-scale` or `user-scalable=no`.

## Images

`unoptimized: true` is set in `next.config.mjs`, and images are served directly from the R2 CDN domains. Do not turn on Next image optimization.

## Component organization

- `src/components/games/create/GameCreateForm.tsx`: helper subcomponents live in `form-parts.tsx`. Trick-catalog filtering (AND logic) lives in `trick-catalog-filters.ts`, which has tests.
- `src/components/games/board/GameBoardControls.tsx`: renders the desktop deck and `GameSheet`, the phone action surface. Each phase's next step comes from `deriveGameSheetView` in `sheet-state.ts` (tested), derived game state from `layout/header-state.ts` (tested), and presentational parts are in `layout/header-parts.tsx`.
- `src/components/feedback/`: `BottomSheet` is the non-modal game-sheet, `SideDrawer` plus `DrawerParts` are for anything opened on purpose. See `DESIGN.md`, `components.overlays`.
- When JSX dereferences `game`, keep the explicit `game &&` guard. TypeScript narrowing is lost across module boundaries.

## Imports

- Import config from `@/lib/config/env`.
- Import hooks directly from `@/hooks/{data,map,preferences,ui}/*`.
- Never import a `@deprecated` shim; use the path the shim names.
