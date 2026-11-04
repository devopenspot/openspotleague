# UI Conventions

`DESIGN.md` is the full design spec (tokens, type, radii, overlay patterns). This page covers the rules most often broken in code.

## Design system

- The UI is monochrome and set in Plus Jakarta Sans.
- `--color-primary` (`#0a0a0a`) is reserved for CTAs, active nav, critical states, and the wire rail. Never use it on dark panels.
- One wash per route (`DESIGN.md` `pages.*`): `bg-gradient-primary` (warm, `#ea580c` → `#dc2626` → `#b91c1c`) on the Home hero and the Games landing page only; `bg-gradient-profile` (lime) on Profile; `bg-gradient-support` (cyan) on Support, data-curator and thank-you. TV is the navy wire (`--color-wire: #060912`). Everything else sits on `bg-surface`.

## Shape rule

Controls and containers are told apart by shape, never by colour.

| Kind | Examples | Radius | Size |
| --- | --- | --- | --- |
| Control | buttons, links styled as buttons, inputs, selects, pills, chips, tabs, tags, icon buttons | `rounded-control` (full) | `h-control` / `min-h-control` 44px; chips `min-h-control-sm` 36px |
| Container | cards, panels, fieldsets, textareas, empty states, image frames | `rounded-container` (16px) | — |
| Nested container | rows or blocks inside a 16px card | `rounded-inner` (14px) | — |
| Tile | stat and glance tiles | `rounded-card` (12px) | — |

- Buttons match inputs: same height, same 1px border.
- Exceptions: game sessions (`/games/:id`) keep their 48px+ outdoor targets, and map pins stay 4px.
- No new `rounded-[*]` literals.

## Recipes

`src/components/ui/recipes.ts` is the single source for the shared class strings. Use it instead of re-typing classes.

- Controls: `controlClass(tone, size)` with `primary`, `secondary`, `outline`, `onWash`, `onWashDark`, `onWire`, `onWireOutline`, `onPhoto`; `iconButtonClass`; `INPUT`, `INPUT_ON_WIRE`, `TEXTAREA`.
- Chips, tags, tabs: `chipClass(active, surface)`, `tagClass(tone)`, `SEGMENTED_TRACK` + `segmentClass(active)`.
- Type: `EYEBROW` (and `EYEBROW_ON_WASH`, `EYEBROW_ON_WIRE`), `PAGE_TITLE`, `SECTION_TITLE`, `CARD_TITLE`, `META`, `LABEL`, `BODY`. Title recipes carry no colour; add it at the call site.
- Containers: `CARD`, `CARD_FRAME`, `CARD_NESTED`, `TILE`, `EMPTY_STATE`, `PANEL_ON_WIRE`, `alertClass(tone)`.
- Layout: `pageContainer(width)` gives `mx-auto max-w-* px-5 md:px-10` plus the default vertical rhythm.

`cn` (`src/lib/utils/cn.ts`) joins classes without merging, so two utilities for the same property are resolved by CSS order, not by call order. Never override a recipe's radius, height or colour from the call site, and never restyle a shared component with `!important` classes. Add a variant instead.

## Shell chrome

- Header: `py-3` plus one control row plus a 1px border, exposed as `--app-header-h`. Use it for sticky offsets and `min-h-[calc(100dvh-var(--app-header-h))]`.
- Bottom bar: 77px plus the safe area, exposed as `--mobile-nav-h`. `AppShell` pads `main` by it below `md`.
- Nav is a "pill track" on the black chrome. Inactive items are `text-wire-muted`; the active item is an inverted `bg-on-wire text-wire` pill. Desktop items sit in a `rounded-control bg-wire-border p-1` track, the bottom bar draws the pill behind the icon, and drawer rows are full-width pills. `NavLink` variants own these styles; never restyle them from a parent.
- `AppShell` owns the `<main>` landmark. Pages render a `<div>`, never a nested `<main>`.

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
