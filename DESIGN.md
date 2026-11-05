---
name: Lumina Soft
description:
  Outdoor catalog + monochrome dashboard. One festival wash per route,
  monochrome everywhere else so photos and maps stay the focus. Shape tells
  controls from containers — every control (button, input, pill, chip, tab,
  tag) is full-radius and 44px, buttons match inputs; every container
  (card, panel, fieldset) is a 16px block. Black "wire" chrome with a pill
  track nav, high-contrast type for outdoor glare, shadowless flat with
  subtle hover/border, soft brutalist pins. Class recipes live in
  src/components/ui/recipes.ts. Three overlay patterns only — flush
  top-sheet (search), right side-drawer (tasks you open yourself), and the
  non-modal game-sheet (live game sessions on phones).
colors:
  surface: "#f7f9fb"
  surface-dim: "#d8dadc"
  surface-bright: "#f7f9fb"
  surface-container-lowest: "#ffffff"
  surface-container-low: "#f2f4f6"
  surface-container: "#edf0f3"
  surface-container-high: "#e7eaee"
  surface-container-highest: "#e1e5e9"
  on-surface: "#121212"
  on-surface-variant: "#44474a"
  outline: "#74777a"
  outline-variant: "#c4c7ca"
  primary: "#0a0a0a"
  on-primary: "#ffffff"
  primary-container: "#e8e8e8"
  on-primary-container: "#1a1a1a"
  secondary: "#565f69"
  on-secondary: "#ffffff"
  secondary-container: "#dae3ef"
  on-secondary-container: "#131c25"
  tertiary: "#635b70"
  on-tertiary: "#ffffff"
  tertiary-container: "#e9def8"
  on-tertiary-container: "#1f182b"
  error: "#ba1a1a"
  on-error: "#ffffff"
  error-container: "#ffdad6"
  on-error-container: "#410002"
  inverse-surface: "#402b29"
  inverse-on-surface: "#ffedea"
  surface-tint: "#0a0a0a"
  inverse-primary: "#a3a3a3"
  primary-fixed: "#e8e8e8"
  primary-fixed-dim: "#d4d4d4"
  on-primary-fixed: "#0a0a0a"
  on-primary-fixed-variant: "#404040"
  secondary-fixed: "#dae3ef"
  secondary-fixed-dim: "#bec7d3"
  on-secondary-fixed: "#141c25"
  on-secondary-fixed-variant: "#3f4851"
  tertiary-fixed: "#e9def7"
  tertiary-fixed-dim: "#cdc2db"
  on-tertiary-fixed: "#1f182a"
  on-tertiary-fixed-variant: "#4b4357"
  background: "#fff8f7"
  on-background: "#291715"
  surface-variant: "#e8e8e8"
  # hero/marketing gradient — the ONLY warm wash (home hero + games landing).
  # Only spelling: `bg-gradient-primary` utility or `var(--gradient-primary)`.
  # Raw `from-orange-*/via-red-*` literals are banned even when near-equal.
  accent-start: "#ea580c"
  accent-via: "#dc2626"
  accent-end: "#b91c1c"
  gradient-primary: "linear-gradient(to right, #ea580c, #dc2626, #b91c1c)"
  on-gradient: "#ffffff"
  # route washes — one per route, blessed only (see pages.*)
  gradient-support-start: "#22d3ee"
  gradient-support-mid: "#2dd4bf"
  gradient-support-end: "#0d9488"
  gradient-support: "linear-gradient(to bottom, #22d3ee, #2dd4bf, #0d9488)"
  gradient-profile-start: "#ecfccb"
  gradient-profile-mid: "#d9f99d"
  gradient-profile-end: "#a3e635"
  gradient-profile: "linear-gradient(to right, #ecfccb, #d9f99d, #a3e635)"
  gradient-league-start: "#0284c7"
  gradient-league-mid: "#2563eb"
  gradient-league-end: "#1e40af"
  gradient-league: "linear-gradient(to right, #0284c7, #2563eb, #1e40af)"
  # wire — inverted dark rail (landing marquee), derived from primary.
  # On wire surfaces NEVER use white/* literals — map via wire-* tokens:
  #   text-white → text-on-wire · text-white/60-70 → text-wire-muted
  #   border-white/15 → border-wire-border(-strong) · bg-white/10-15 → bg-wire-border(-strong)
  #   ring-white / ring-offset-wire stay (focus ring on dark needs pure white)
  #   from-wire (edge fades) stays — it IS the token.
  wire: "#0a0a0a"
  on-wire: "#ffffff"
  wire-border: "color-mix(in srgb, #ffffff 10%, transparent)"
  wire-border-strong: "color-mix(in srgb, #ffffff 15%, transparent)"
  wire-muted: "color-mix(in srgb, #ffffff 60%, transparent)"
  # photo scrim — pills floating over imagery (marquee cards, spot heroes).
  # Separate from wire: scrim is translucent dark OVER photos, wire is a page rail.
  scrim: "bg-on-surface/55"
  scrim-border: "border-white/15"
  scrim-text: "text-surface"
  scrim-wash: "bg-gradient-to-t from-on-surface/45 via-transparent to-transparent"
  # tv inverse overlay — dark page with white translucent chrome
  tv-overlay: "rgba(255,255,255,0.04)"
  tv-overlay-strong: "rgba(255,255,255,0.10)"
  tv-overlay-border: "rgba(255,255,255,0.10)"
  # skeleton shimmer — pulse blocks only; color follows the surface underneath:
  # on light surfaces bg-surface-container-high(+lowest), on gradient/wire bg-white/10-25.
  # status/activity exceptions to the monochrome palette
  permission-granted: "#16a34a"
  permission-pending: "#f59e0b"
  permission-denied: "#dc2626"
  activity-empty: "#f0fdf4"
  activity-low: "#bbf7d0"
  activity-medium: "#4ade80"
  activity-high: "#16a34a"
  activity-peak: "#166534"
pages:
  home:
    shell: "surface"
    hero: "gradient-primary"
    wire: "wire"
    note: "Page shell bg-surface; hero is the only full-bleed warm gradient via `bg-gradient-primary` (tokens #ea580c/#dc2626/#b91c1c). Interior cards stay surface-container-lowest. Marquee rail uses wire (=primary)."
  support:
    shell: "gradient-support"
    note: "Full-bleed vertical cyan wash (#22d3ee → #2dd4bf → #0d9488) via `bg-gradient-support`, on /support, /support/data-curator and /thankyouforsupport so the flow keeps one palette. Body ink is on-surface; eyebrows use EYEBROW_ON_WASH; buttons are controlClass('primary') and controlClass('onWash'). Cards inside stay CARD (surface-container-lowest)."
  games:
    shell: "gradient-primary"
    note: "Games landing reuses the same warm hero gradient as home. Board/panel inside stays monochrome."
  map:
    shell: "surface"
    canvas: "map-surface-container-lowest + --map-tile-filter (map section of globals.css)"
    note: "Page shell/sidebar/controls stay strictly light monochrome (surface + outline-variant); ONLY the map canvas, tiles, and on-map markers/overlays use the high-contrast dark palette (--color-map-* + --map-tile-filter, defined in the map section of src/app/globals.css). Pins are the only tight 4px in the app."
  profile:
    shell: "gradient-profile"
    note: "Horizontal lime wash (#ecfccb → #d9f99d → #a3e635) via `bg-gradient-profile` only — never raw from-lime-* literals. ProfileShell applies it with min-h-full to the loaded, loading (ProfileSkeleton) and error states. Tabs and segments are the light pill track (SEGMENTED_TRACK); cards, tiles and rows inside stay white/monochrome with 1px borders."
  tv:
    shell: "inverse-surface"
    overlay: "tv-overlay"
    note: "Dark page: one navy canvas (`--color-wire: #060912`, set in tv/layout.tsx); no bg-black under it. Only the fullscreen player is pure black. Shares the shell gutter (px-5 md:px-10). Row headings are the wire-rail heading (font-display uppercase tracking-eyebrow text-on-wire). Discipline pills are chipClass(active, 'wire'); CTAs are controlClass('onWire' | 'onWireOutline'); the search field is INPUT_ON_WIRE. Text uses on-wire and wire-muted only — no text-black or white/* literals. Video cards are rounded-inner with the locked corner tab (components.tv-card) — never a full-radius tag. Panels use PANEL_ON_WIRE (tv-overlay). All TV loading states come from TvCatalogSkeleton.tsx, whose geometry mirrors TvMarqueeCard, with bg-wire-border blocks and no spinners."
  league-landing:
    shell: "gradient-league"
    hero: "on-surface"
    note: "Horizontal saturated electric-blue/cobalt wash (#0284c7 → #2563eb → #1e40af) via `bg-gradient-league` (LeagueWash) only — never raw from-sky-*/from-blue-* literals. The wash sets text-on-gradient (white ink) and covers /league, /league/[slug] (the hub panel sits on it), /league/[slug]/r/[userId] and /league/join/[code]; league/error.tsx stays on the surface. Landing (LeagueLanding): header straight on the wash (EYEBROW_ON_GRADIENT + visible PAGE_TITLE 'Contests' text-on-gradient + one line of copy); actions are JoinByCodeEntry controlClass('onWash'), Create a contest controlClass('onWashDark') and Ranking controlClass('onWash') (both signed in only). Signed-in users then get My contests (SECTION_TITLE text-on-gradient; Organizing / Judging / Riding groups of CARD rows with tag pills and PaymentGateNotice). Public contests sits below a border-on-gradient/20 rule: SEGMENTED_TRACK status filter (All/Live/Upcoming/Past with counts, empty statuses hidden unless active), the single META_ON_GRADIENT count, then Featured (dark bg-on-surface hero, one scrim, View contest controlClass('onWire') + Official site controlClass('onPhoto')), Live & upcoming (ContestCard grid) and Past contests (compact ContestCard, 4 columns on lg). Free contests are never listed, so the directory's empty state explains that public listings arrive with the paid tiers. ContestCard is CARD_FRAME with tagClass('onPhoto') labels; the whole card opens /league/[slug] via a stretched title link, and the only other targets are footer iconButtonClass('outline') links (socials, official site). Covers: an uploaded photo, otherwise ContestCover — the wash with a Trophy and category · disciplines line, never the generic OG image. Detail page: full-bleed hero on phones (CARD_FRAME from md), a TILE countdown, an aside with Run the contest (organizers, primary) and Judging (judges/organizers) linking into the hub, official site, map and ShareActions (public contests only; private contests show a 'Private contest' note), socials. On-wash ink uses on-gradient tokens, never white/* literals (skeleton blocks excepted)."
  league:
    shell: "surface"
    note: "The League working tools stay monochrome surface (no wash): /league/new (also reused as /admin/league/contests/new in curator mode), /league/ranking, and the contest hub — a full-width surface panel (same frame as the contest article: border-y on phones, rounded-container from md) placed under the contest article on the wash at /league/[slug]#hub. Hub: EYEBROW 'Your contest dashboard' + role tag, then ONE Your-next-step CARD (icon, LABEL, CARD_TITLE, BODY, one action: primary when there is something to do, outline while waiting), the LifecycleStepper (Run tab only; rounded-card steps, primary border on the current one), then SEGMENTED_TRACK tabs (Overview, Standings, My runs, Judging, Run the contest — per role). Panels are CARDs; nested rows CARD_NESTED; empty blocks EMPTY_STATE; details/summary for long guidance. Scoring is used outdoors on phones: RatedScoreForm steppers are iconButtonClass('outline','lg') around a 24px tabular value with an InfoPopover of the criterion guidance, element ticks are chipClass checkboxes, submit is controlClass('primary','lg') and stays disabled until every criterion is set (the live line says what is missing). Standings rows: 36px rank chip (primary for #1), name + You tag(solid), Junior/Senior · city LABEL, tabular score, Provisional(outline)/Final(solid) tag. Forms use the league form parts (src/components/league/form-parts.tsx); the create form's Format section uses two radio cards (rounded-inner, primary border when chosen) for Live/Video and discipline rows of format chips. The result card page (/league/[slug]/r/[userId]) is a CARD on the wash with TILE stats and ShareActions. Columns: pageContainer('3xl') for create and the result card, ('5xl') for the ranking."
  admin:
    shell: "surface-bright"
    note: "Flat monochrome — surface-bright + outline-variant borders, no wash."
  spot-detail:
    shell: "surface"
    hero: "on-surface"
    note: "Large photo hero with on-surface scrim + full-radius photo controls (controlClass('onPhoto')) and labels (tagClass('onPhoto'), TypeBadges size md) — see components.scrim-pills. The hero is full-bleed on phones; content sections use the px-5 gutter and the frame is md:px-10. Actions and location links are pill controls; suggested-spot filters are chips. Error, not-found and 503 states share one CARD."
  chrome:
    note: "Header, bottom bar, mobile drawer and the search top-sheet are the black wire chrome (bg-primary / wire tokens), never a pages.* gradient. On TV the wire is navy via the route override. Nav uses the pill track (components.nav). Header height is --app-header-h, the bottom bar is --mobile-nav-h. The header is sticky top-0 and stays pinned for the whole page (see spacing.note for the shell height that makes this hold)."
  login:
    shell: "surface"
    note: "Phones: no card — content sits straight on the px-5 gutter; the card frame (CARD_FRAME values, sm:px-8 sm:py-10) starts at sm. EYEBROW tagline above PAGE_TITLE, then BODY copy and the error alertClass('error'). Continue with Google (primary) and Back to directory (outline) are stacked full-width lg (48px) controls; from sm Back is a plain pill. Fine print sits below the actions."
typography:
  font-family: Plus Jakarta Sans, sans-serif
  # Single family — both display and sans map to Plus Jakarta Sans (via next/font --font-jakarta)
  # Live literals are canonical; --text-* aliases are legacy but parity-kept in globals.css
  scale-live:
    micro: "9px / 700 / uppercase / tracking 0.05-0.08em — pin labels, scrim pills, hero numerals ONLY (never body)"
    label: "10-12px / 600-700 / uppercase / tracking 0.04-0.12em — pills, badges, eyebrows, tags"
    body: "14-16px / 400-600 / leading 1.5 — descriptions, spot/event copy"
    title: "18-20px / 600-700 / uppercase tight — card titles, section headers"
    headline: "24-32px / 700 / tight — SectionHeader md:text-[32px]"
    display: "32-48px mobile 32 / 700 / tracking -0.02-0.03em — Hero/event featured title only"
  tracking-steps: "tracking-dense 0.04em (dense card rows) · tracking-label 0.05em (labels/badges/tags) · tracking-pill 0.08em (pills/CTAs/nav) · tracking-eyebrow 0.12em (eyebrows/rail headings) · tracking-display -0.02em (page titles) — use the tokens, never tracking-[*] literals or tracking-wide(r/st)"
  recipes:
    source: "src/components/ui/recipes.ts"
    EYEBROW: "font-display text-xs font-bold uppercase tracking-eyebrow text-secondary (EYEBROW_ON_WASH: text-on-surface, EYEBROW_ON_GRADIENT: text-on-gradient/80 for the saturated League wash, EYEBROW_ON_WIRE: text-wire-muted)"
    PAGE_TITLE: "font-display text-2xl sm:text-4xl font-bold uppercase leading-tight tracking-display (no colour)"
    SECTION_TITLE: "font-display text-xl sm:text-2xl font-bold uppercase leading-tight tracking-tight (no colour)"
    CARD_TITLE: "font-display text-lg font-bold uppercase leading-tight tracking-tight (no colour)"
    META: "font-display text-xs font-semibold uppercase tracking-label text-secondary — counts, dates, scopes (META_ON_GRADIENT: text-on-gradient/80)"
    LABEL: "font-display 10px bold uppercase tracking-label text-secondary — stat/field labels"
    BODY: "text-sm leading-relaxed text-on-surface-variant, weight 400"
  tokens-legacy:
    display: { size: 48px, weight: "700", line-height: "1.2", letter-spacing: -0.02em }
    headline: { size: 32px, weight: "700", line-height: "1.3" }
    title: { size: 20px, weight: "600", line-height: "1.4" }
    body: { size: 16px, weight: "400", line-height: "1.5" }
    label: { size: 12px, weight: "600", line-height: "1.2", letter-spacing: 0.05em, text-transform: uppercase }
  font-mono: "ui-monospace — only via the <Eyebrow> stamp component (10px mono, e.g. numbered steps, 'Coming soon'), and the ⌘K kbd. Section eyebrows use the EYEBROW recipe (display), not mono."
  rules:
    - "Tracking: display -0.02em only for large titles; pick the nearest tracking-step above — ad-hoc tracking-[0.08em] in Hero is the reference."
    - "Weights: 700 for headings/CTAs, 600 for labels, 400 for body copy — no light weights."
    - "Always text-base (16px) on inputs on mobile to prevent iOS zoom — enforced in globals.css base + @media (max-width:639px)."
shape:
  rule: "Controls vs containers. Controls — buttons, links styled as buttons, inputs, selects, pills, chips, tabs, tags/badges, icon buttons, nav items — are rounded-control (full). Containers — cards, panels, fieldsets, textareas, empty states, alerts, image frames, sheets — are rounded-container (16px). Buttons match inputs: same height (h-control 44px), same 1px border."
  radius-none: 0px
  radius-sm: 4px
  radius-md: 8px
  radius-card: 12px
  radius-inner: 14px
  radius-lg: 16px
  radius-container: 16px
  radius-chassis: 20px
  radius-xl: 24px
  radius-full: 9999px
  radius-control: 9999px
  usage:
    - "control (full) — every button, input, select, pill, chip, tab, tag, badge, icon button, nav item, toast action/dismiss"
    - "container (16px) — SpotCard, ContestCard, CARD, panels, fieldsets, textareas, empty states, toasts, overlay panels, drawer footer cards"
    - "inner (14px) — rows/blocks nested inside a 16px container (CARD_NESTED), MarqueeCard and TV video cards, skeleton inner blocks. Never top-level."
    - "card (12px) — stat and glance tiles (TILE), alerts (alertClass), TV queue items"
    - "sm (4px) — map pins, the map event markers (tier pill and square), and the locked TvMarqueeCard corner tab (rounded-tl-sm rounded-br-sm, see components.tv-card) only"
    - "chassis 20px / xl 24px — game PanelShell chassis only"
  literal-map: "rounded-[4px]→rounded-sm · rounded-[8px] on a tag→rounded-control · rounded-[12px]→rounded-card · rounded-[14px]→rounded-inner · rounded-[16px]→rounded-container · rounded-[9999px]→rounded-control — no new rounded-[*] literals"
  exceptions: "Game sessions (/games/:id) keep 48px+ outdoor targets (LocationBlockedCallout size lg). Map pins stay 4px. The 4px TvMarqueeCard corner tab (rounded-tl-sm rounded-br-sm, flush top-left) is a LOCKED exception to the full-radius tag rule — see components.tv-card."
spacing:
  margin-mobile: 20px
  margin-desktop: 40px
  gutter: 16px
  gap-sm: 8px
  gap-md: 16px
  gap-lg: 24px
  section: 80px
  stack-sm: 8px
  stack-md: 24px
  control: "2.75rem (44px) — h-control / min-h-control / w-control"
  control-sm: "2.25rem (36px) — chips, segments, desktop nav items"
  app-header-h: "calc(2.75rem + 1.5rem + 1px) — py-3 + one control row + border"
  mobile-nav-h: "calc(77px + env(safe-area-inset-bottom))"
  page-gutter: "px-5 (20px) md:px-10 (40px) — pageContainer(width) in recipes.ts; widths 3xl (league forms), 5xl (profile, League ranking), 6xl (spot, support, TV), 7xl (landing, League landing and contest page)"
  note: "Tokens map to Tailwind literals: gap-2=8, gap-4=16, gap-6=24, px-5=20. Every page and the shell chrome share the px-5/md:px-10 gutter; photo heroes may bleed on phones. BottomNav is 77px plus the safe area (var(--mobile-nav-h)), and main content pads by the same variable; Header is content-height (--app-header-h), not fixed. Shell height: on routes where the document scrolls, the AppShell root is min-h-dvh so main's nav padding lands after the last line (an h-dvh root would leave the last ~77px under the bottom bar). Only the map, /games/:id, /games and / keep a one-screen h-dvh frame, and they scroll inside main. Toast viewport sits at bottom-[calc(var(--mobile-nav-h)+1rem)] md:bottom-6."
motion:
  durations: "150ms ease-out base (pills, chevrons, NavLink), 300ms image hover scale-102, 500ms hero scale-105, 180ms pin pulse (one-shot active state), 2.5s user ping"
  easings: "ease-out default, linear for radar sweep (3.5s), cubic-bezier(0, 0, 0.2, 1) for ping"
  keyframes: "fadeIn 0.3s / slideUp 0.4s / pingSlow 2s / radarSweep 3.5s / heartBurst 600ms / leafletPinPulse 180ms / leafletUserPing 2.5s / ledOn 1.2s / ledBlink 0.6s + panel-scan"
  performance-rule: "animate-pulse and infinite pulse animations are strictly BANNED across all user interface components, buttons, badges, status dots, cards, and specifications. Rationale: Continuous CSS opacity/scale pulse loops force continuous repaints, compositor churn, and battery drain in web browsers. Stopping use is mandatory and non-negotiable. ONLY EXCEPTION: Transient skeletons and loading components (*Skeleton.tsx, loading.tsx, Suspense fallbacks), which are short-lived placeholders unmounted once data arrives."
  reduced-motion: "All disabled via @media (prefers-reduced-motion: reduce) — respects useReducedMotion in Toast"
  shadows: "Shadowless by default (shadow-none). Exceptions: PanelShell inset+ 0 8px 24px, MarqueeCard hover:shadow-md + -translate-y-px, hover:shadow-sm on discover cards."
  overlays: "Overlay flush-top: spring damping 30 stiffness 320, 0.18s fade fallback. SideDrawer: 280ms ease-out enter, 200ms ease-in exit, backdrop bg-on-surface/50 0.18s. Game-sheet: 280ms ease-out between detents, 0ms under reduced motion. Toast: opacity/y 0.16s easeOut stagger 0.04."
components:
  controls:
    source: "controlClass(tone, size), iconButtonClass, INPUT, chipClass, tagClass, SEGMENTED_TRACK/segmentClass in src/components/ui/recipes.ts"
    shape: "rounded-control (full), 1px border, min-h-control (44px; sm 36px; lg 48px for /games/:id sessions), px-5, font-display text-xs bold uppercase tracking-pill, active:translate-y-px"
    tones:
      primary: "border-primary bg-primary text-on-primary — the one main action per surface"
      secondary: "border-outline-variant bg-surface-container-high text-on-surface"
      outline: "border-outline-variant bg-surface-container-lowest text-on-surface — quiet actions on light surfaces"
      onWash: "border-on-surface bg-surface-container-lowest text-on-surface — light button on a route wash (Home hero, Support, Profile, League)"
      onWashDark: "on-primary-container fill, text-on-primary — dark button on a wash"
      onWire: "bg-on-wire text-wire — solid button on the black/navy wire (header Sign in, TV CTAs)"
      onWireOutline: "bg-wire-border border-wire-border-strong text-on-wire — icon buttons and quiet actions on the wire"
      onPhoto: "scrim pill: border-white/15 bg-on-surface/55 text-surface backdrop-blur-md"
    inputs: "INPUT matches the button: rounded-control, min-h-control, 1px outline-variant border, text-base sm:text-sm. INPUT_ON_WIRE for dark rails. TEXTAREA is a container (rounded-container)."
    chips: "chipClass(active, 'light'|'wire') — min-h-control-sm, text-xs bold tracking-label; active is solid primary (light) or on-wire (wire)"
    tags: "tagClass(tone, size) — non-interactive full-radius labels, 10px bold tracking-label (size lg is 14px for /games/:id sessions): neutral, outline, solid, onWire, onPhoto (exception: the TV card corner tab is not a tagClass, see components.tv-card)"
    segments: "SEGMENTED_TRACK + segmentClass(active): a rounded-control track (p-1) with an inverted active pill — the light-surface twin of the nav pill track"
    rule: "Never place a primary-solid control on a dark panel (bg-on-surface) — use onWire there. cn does not merge classes: pick a tone, never override radius/height/colour at the call site."
  cards:
    bg: var(--color-surface-container-lowest)
    radius: var(--radius-lg)
    border: 1px solid var(--color-outline-variant)
    padding: 16px
    recipe: "CARD (CARD_FRAME + p-4 sm:p-5), CARD_NESTED, TILE, EMPTY_STATE, PANEL_ON_WIRE, alertClass(tone)"
    note: "Default card is rounded-container (16px): SpotCard, ContestCard, SurfaceCard, CARD. Rows nested INSIDE a 16px card use rounded-inner (14px). Never a card inside a card — drop the inner frame (e.g. ProfileTricksPanel bare). Borders are 1px."
  badges:
    radius: var(--radius-control)
    padding: 4px 10px
    text-style: "font-display 12px bold uppercase tracking-label"
    note: "Badge (ui/Badge.tsx) tones use semantic containers — neutral/info/success vs error. Full radius like every tag."
  nav:
    pattern: "Pill track on the black wire chrome — one active treatment everywhere"
    desktop: "AppNavList desktop = rounded-control bg-wire-border p-1 track; NavLink items min-h-control-sm px-4 text-xs bold uppercase tracking-pill; inactive text-wire-muted hover:bg-wire-border-strong; active bg-on-wire text-wire. The 'you' group is a second track (lg+)."
    bottom-bar: "77px + safe area, bg-primary, border-t wire-border. Each tab: icon in an h-8 w-14 rounded-control pill over an 11px semibold uppercase tracking-label label; active pill bg-on-wire text-wire, label text-on-wire; inactive text-wire-muted."
    drawer: "Rows are full-width rounded-control min-h-control pills: bg-wire-border at rest, bg-on-wire text-wire when active. Footer: Preferences and Sign out are controlClass('onWireOutline'), profile card is a rounded-container wire card, Sign in is controlClass('onWire')."
    header-actions: "Search, notifications, menu and drawer close are iconButtonClass('onWireOutline') circles (44px, icon 18)."
    badges: "Count badges are bg-on-wire text-wire rounded-control with ring-2 ring-wire so they read on the active white pill too."
    rule: "NavLink variants own every nav style. Never restyle a NavLink, SignInLink or SignOutButton from a parent or with !important — add a variant."
  overlays:
    note: "Exactly three patterns — pick one, never a fourth. Top-sheet and side-drawer are modal: they lock body scroll, trap focus, close on Escape, honor reduced-motion. The game-sheet is the only non-modal pattern. None of them auto-open during play."
    game-sheet:
      component: "BottomSheet (GameSheet) — /games/:id below md only"
      container: "non-modal, no backdrop, always open; the page behind stays scrollable and tappable"
      detents: "peek, half, full. Peek carries the status line and the one primary action; half adds trick detail; full adds the board and session actions."
      rule: "No action may depend on a drag: actions stay pinned to the sheet's visible bottom edge at every detent, and a full-width 48px handle button cycles detents. Swipe-down stops at peek, the sheet cannot close. State may change the detent, but never over a choice the rider made during the current round."
      panel: "bg-surface-container-lowest, rounded-t-lg, border-t-2 border-on-surface, pb-[env(safe-area-inset-bottom)]"
    top-sheet:
      component: "Overlay flush animation=top (SearchOverlay)"
      container: "z-[1300], flush full-bleed column"
      panel: "bg-surface-container-lowest, content max-w-3xl mx-auto p-5 sm:p-6 md:p-8"
      backdrop: "fixed inset-0 bg-on-surface opacity 0.5 — click closes unless gate forced (closeOnBackdrop=false + role=alertdialog)"
      header-row: "search field row radius-lg border-outline-variant bg-surface-container-low; step label (eyebrow) + Close button (secondary button pattern) right"
    side-drawer:
      component: "SideDrawer side=right (MobileDrawer, MatchesDrawer, GameShareDrawer, ChallengeSettingsModal) with DrawerHeader / DrawerFooter from DrawerParts"
      container: "z-[1200], portalled to body"
      panel: "SIDE_DRAWER_PANEL: w-[min(24rem,calc(100vw-2.5rem))] overflow-hidden rounded-l-lg, leaving 40px of the page visible — NO border on a right-side drawer"
      gestures: "Touch swipe toward the edge closes (96px or 500px/s). Mouse never drags, so text stays selectable."
      timing: "Only ever opened by a tap: side-drawers never auto-open."
      backdrop: "absolute inset-0 bg-on-surface opacity 0.5"
      header: "DrawerHeader: eyebrow, title, and one circular close button (iconButtonClass, X at 20). MobileDrawer is the wire chrome: BrandLogo + iconButtonClass('onWireOutline') close."
      footer: "Light drawers: border-t border-outline-variant bg-surface-container-low px-5 py-5. MobileDrawer: border-t border-wire-border bg-primary, see components.nav.drawer."
      rule: "NavLink variants own their own styles — never restyle [data-nav-tab] from the drawer/header parent."
  scrim-pills:
    note: "Pills floating over photography (MarqueeCard kind/meta/title, spot heroes). Blessed exception to monochrome: translucent dark pills on image. TV video cards (TvMarqueeCard) do NOT use scrim pills — they keep the locked solid corner tab (components.tv-card)."
    pill: "rounded-full border border-white/15 bg-on-surface/55 text-surface backdrop-blur-md, micro 9px bold uppercase 0.08em"
    spot-photos: "On the spot hero, controls are controlClass('onPhoto') (full, 44px, white focus outline) and labels are tagClass('onPhoto') or TypeBadges variant overlay size md — all full radius."
    wash: "bg-gradient-to-t from-on-surface/45 via-transparent to-transparent over the image bottom"
    rule: "Scrim pills live on photos only — never on flat surfaces (use badges there)."
  tv-card:
    component: "src/components/tv/marquee/TvMarqueeCard.tsx (TV rows, Continue watching, search grid)"
    status: "LOCKED — owner decision (2026-11-04). Keep this exact style until the owner says otherwise. Do not restyle, tokenise or 'normalise' it in consistency passes; if a rule seems to conflict, flag it instead of changing the card."
    frame: "button w-[240px] sm:w-[270px] (fluid: w-full), flex-col gap-2; thumb is aspect-video rounded-inner overflow-hidden bg-wire-border, active:scale-[0.99], focus-visible ring-2 ring-white ring-offset-2 ring-offset-wire, active card ring-2 ring-on-wire"
    corner-tab: "absolute left-0 top-0 rounded-tl-sm rounded-br-sm inline-flex items-center bg-on-wire px-2 py-1 font-display text-[10px] font-bold uppercase leading-none tracking-label text-wire — flush to the thumb's top-left corner (no inset), 4px (radius-sm) on the top-left and bottom-right corners only. Content: 'New' or the discipline slug, truncate max-w-[14ch]."
    wash: "absolute inset-0 bg-gradient-to-t from-on-surface/45 via-transparent to-transparent"
    brand-mark: "TvBrandMark — 24px round mark, bottom-right (bottom-2 right-2)"
    progress: "Continue watching only: absolute inset-x-0 bottom-0 h-1 bg-wire-border-strong track with bg-on-wire fill"
    text: "title line-clamp-2 text-sm font-semibold leading-snug text-on-wire; meta truncate text-xs text-wire-muted"
    rule: "The corner tab is NOT a tagClass, NOT a scrim pill, NOT rounded-control/full radius and NOT inset (no left-2 top-2). It is the one sanctioned exception to the shape rule for tags."
  skeleton:
    note: "Loading mirrors of Hero + wire rail (HomeSkeleton). Pulse blocks only (animate-pulse is blessed strictly and solely for skeletons and loading components), no spinners; keep layout dimensions identical to the loaded component."
    on-light: " rounded bg-surface-container-high (blocks) / bg-surface-container-lowest (inner cards)"
    on-gradient-or-wire: " bg-white/10-25 (never surface tokens — invisible on dark)"
  empty-state:
    note: "EMPTY_STATE: dashed-border centered block for zero results. rounded-container border-dashed border-outline-variant bg-surface-container-low, secondary label copy, one control."
  gate-alert:
    note: "alertClass(tone): rounded-card border + tinted bg + EYEBROW title + body. LocationBlockedCallout uses it. Never a raw primary/10 black tint."
  toast:
    generic: true
    palette: "Monochrome — same as cards (bg-surface-container-lowest or surface, border-outline-variant, text-on-surface). No per-page tint. Stays generic for all routes."
    container:
      bg: var(--color-surface-container-lowest)
      border: 1px solid var(--color-outline-variant)
      radius: var(--radius-lg)
      shadow: "sm"
      padding: "px-4 py-3"
      note: "Relaxed, not square. Fresh air via shape, not color."
    tag: "font-display 10px bold uppercase tracking-widest [ INFO / OK / ERR ] — text-on-surface, stays monochrome"
    title: "font-display xs bold uppercase tracking-widest text-on-surface"
    message: "xs text-on-surface (semibold without title, normal with title)"
    action:
      radius: var(--radius-full)
      border: "1px solid var(--color-outline-variant)"
      bg: var(--color-surface-container-high)
      text: "font-display 10px bold uppercase"
      note: "Pill, not underlined 4px rect. Hover text-primary."
    dismiss:
      radius: var(--radius-full)
      size: "h-11 w-11 (44px)"
      border: "none or left border-outline-variant only if needed"
      note: "Circular 44px, not rounded-r-[4px] rect with left border-on-surface. Hover bg-surface-container."
    overflow:
      radius: var(--radius-lg)
      border: "1px solid var(--color-outline-variant)"
      bg: var(--color-surface-container-lowest)
      text: "font-display 10px bold uppercase — +N more, self-center"
    viewport: "fixed bottom-[calc(var(--mobile-nav-h)+1rem)] left-1/2 -translate-x-1/2 z-[1400] w-[min(28rem,calc(100vw-2rem))] gap-2 md:bottom-6; above every overlay. placement=top below md during game sessions, where the game-sheet owns the bottom edge."
    motion: "motion/react opacity/y 0.16s easeOut stagger 0.04, useReducedMotion opacity-only"
    a11y: "error tone role=alert aria-live=assertive + border-l-2 or dot may remain but not square; others role=status polite"
  pins:
    pin: "Map palette (globals.css) — border-map-outline (#c29e99) bg-map-surface-container (#303030) text-map-on-surface (#efefef) radius-sm 4px; active inverts to bg-map-electric (#ff3131) text-on-primary border-map-primary (#ffc4bd) outline 2px map-primary + ambient glow + leafletPinPulse 180ms; saved uses bg-map-surface-container-high (#3b3b3b) text-map-primary border-map-primary + map-primary-container (#ff6b63) corner notch"
    cluster: "Map palette (globals.css) — bg-map-surface-container-high (#3b3b3b) text-map-primary (#ffc4bd) border-1.5 border-map-primary-container (#ff6b63) radius-lg 16px 30px chip + ambient glow"
    user: "Map palette (globals.css) — crosshair + ring 2.5s ping + dot 10px in map-tertiary (#82ddf7 cyan) with 2px map-tertiary-fixed (#c4f0ff) border + cyan glow; nearby radius circle uses #82ddf7 / #36b1d0"
    event: "Map palette (globals.css) — tier 8px 4px radius bg-map-surface-container-low (#2b2b2b) border-map-outline (#c29e99) text-map-on-surface-variant (#f0ccc9); square 88-132px 4px radius bg-map-surface-container (#303030) text-map-on-surface border-map-primary-container (#ff6b63) (active bg-map-electric #ff3131 outline 2px map-primary #ffc4bd); status dot live (#ff3131)/upcoming (#ffc4bd)/completed (#d6d4d3) by form"
  panel:
    chassis: "radius-chassis 20px border 1.5px on-surface bg-surface-container-high + inset highlight"
    screen: "radial highlight + 0 2px 12px shadow, no scanline"
    deck: "surface-container + border-top outline-variant"
guidelines:
  - "Performance Rule — Strict Ban on animate-pulse in UI: Never use animate-pulse or continuous pulse animation loops in user interface components, controls, badges, status dots, or live indicators. Web browser performance, battery efficiency, and repaint minimization make this mandatory and non-negotiable. Only one exception: transient loading UI (*Skeleton.tsx, loading.tsx, Suspense fallbacks)."
  - "Monochrome is the system (surface ladder #f7f9fb → #ffffff → #e7eaee). Color only via blessed washes in pages.* plus permission/activity LEDs — photos/maps stay the focus."
  - "All maps across the entire site (LeafletCanvas, SpotStaticMap, SpotMapFallback) use the dedicated high-contrast dark palette (--color-map-* tokens and --map-tile-filter on .leaflet-tile-pane / .map-tile-dark, map section of globals.css) ONLY for the map canvas, tiles, and on-map markers/overlays; surrounding page shells, layouts, sidebars, and cards stay light monochrome."
  - "One wash per route, picked from pages.* only — never invent a new from-*/via-* gradient. Use var(--gradient-*) or bg-gradient-*."
  - "Reserve #0a0a0a (primary — pure black) for CTAs, critical states, active pins and the wire chrome (header, bottom bar, drawer, marquee rail). Never a primary-solid control on a dark panel — use controlClass('onWire')."
  - "Shape rule: controls are rounded-control (full) and h-control (44px), buttons match inputs; containers are rounded-container (16px), nested rows rounded-inner (14px), tiles rounded-card (12px). No new rounded-[*] literals — use shape.literal-map."
  - "Build from src/components/ui/recipes.ts. Never override a recipe's radius/height/colour from the call site and never restyle shared components with !important — cn does not merge Tailwind classes."
  - "Every page shares the px-5 md:px-10 gutter (pageContainer). AppShell owns <main>; pages render a <div>."
  - "On wire surfaces use wire-* tokens, never white/* literals. On photos use scrim-pills. The two never mix."
  - "Overlays: pick top-sheet, side-drawer, or game-sheet from components.overlays — never a fourth pattern. Nav is the pill track (components.nav); never restyle NavLink from a parent."
  - "Keep type high-contrast (Plus Jakarta Sans bold/600, tight tracking) for outdoor glare. Use the typography.recipes; mono only for the <Eyebrow> stamp."
  - "Outdoor session rule — inside /games/:id on phones: text at least 14px (the 10-12px label convention does not apply here), controls at least 48px, gaps at least 12px, result buttons 72px with 18px bold labels. Use controlClass(tone, 'lg') and tagClass(tone, 'lg') there. Landed is solid primary with a check, Failed is white with a 3px on-surface border and an X: they differ by fill, shape, and icon, never by hue alone. Status is text plus icon, never colour alone. No CRT scanline."
  - "Shadows are the exception, not the rule — Panel chassis + Marquee hover are the only 8-24px + shadow sits. Else flat border."
  - "New pages/sections must declare their pages.* entry first — if not listed, default to surface monochrome."
  - "Locked styles (components.tv-card) are owner decisions: never 'normalise' them in consistency or refactor passes — flag the conflict instead. Only the owner unlocks them."
open-follow-ups:
  # Outside the consistency pass; each is UI-only unless noted.
  - "pages not yet on the recipes: spot create, admin."
  - "/explore no longer exists but is still linked or revalidated (spot error/not-found, nav.ts, sitemap.ts, revalidatePath in spot services, needsSeedForPath in proxy.ts) — behaviour fix, not styling."---
