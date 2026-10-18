---
name: Lumina Soft
description:
  Outdoor catalog + monochrome dashboard. One festival wash per route,
  monochrome everywhere else so photos and maps stay the focus. Relaxed
  16px/full for interactive, 14px for cards nested inside 16px parents,
  high-contrast type for outdoor glare, shadowless flat with subtle
  hover/border, soft brutalist pins. Two overlay patterns only:
  flush top-sheet (search) and right side-drawer (nav).
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
  gradient-explore-start: "#22d3ee"
  gradient-explore-mid: "#2dd4bf"
  gradient-explore-end: "#0d9488"
  gradient-explore: "linear-gradient(to bottom, #22d3ee, #2dd4bf, #0d9488)"
  gradient-profile-start: "#ecfccb"
  gradient-profile-mid: "#d9f99d"
  gradient-profile-end: "#a3e635"
  gradient-profile: "linear-gradient(to right, #ecfccb, #d9f99d, #a3e635)"
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
  explore:
    shell: "gradient-explore"
    note: "Full-bleed vertical wash from #22d3ee via #2dd4bf to #0d9488. Only Explore uses this wash. Tabs, cards, directory inside stay monochrome surface-container-lowest."
  games:
    shell: "gradient-primary"
    note: "Games landing reuses the same warm hero gradient as home. Board/panel inside stays monochrome."
  map:
    shell: "surface"
    canvas: "map-surface-container-lowest + --map-tile-filter (see DESIGN_MAP.md)"
    note: "Page shell/sidebar/controls stay strictly light monochrome (surface + outline-variant); ONLY the map canvas, tiles, and on-map markers/overlays use the high-contrast dark palette from DESIGN_MAP.md (--color-map-* + --map-tile-filter). Pins are the only tight 4px in the app."
  profile:
    shell: "gradient-profile"
    note: "Horizontal wash from #ecfccb via #d9f99d to #a3e635. The lime pages — only Profile uses it. Stats/activity inside stay white/monochrome."
  tv:
    shell: "inverse-surface"
    overlay: "tv-overlay"
    note: "Dark page (near-black / inverse-surface). Cards use translucent white overlay (white/4-10, border white/10) — documented inverse exception, not ad-hoc white literals."
  sport-events:
    shell: "surface"
    hero: "on-surface"
    note: "Surface shell + dark featured hero (bg-on-surface) with white text — same inverse logic as TV but limited to the feature hero."
  admin:
    shell: "surface-bright"
    note: "Flat monochrome — surface-bright + outline-variant borders, no wash."
  spot-detail:
    shell: "surface"
    hero: "on-surface"
    note: "Large photo hero with on-surface scrim + white pills (see components.scrim-pills) — keeps spot photo hero, not a gradient wash."
  chrome:
    note: "Overlays and drawers are chrome, not washes — they never take a pages.* gradient. SearchOverlay top-sheet and MobileDrawer side-drawer both sit on monochrome panels (see components.overlays)."
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
  tracking-steps: "0.04em (dense card rows) · 0.05em (labels/badges) · 0.08em (pills/CTAs) · 0.12em (eyebrows/stats) — no other tracking literals"
  tokens-legacy:
    display: { size: 48px, weight: "700", line-height: "1.2", letter-spacing: -0.02em }
    headline: { size: 32px, weight: "700", line-height: "1.3" }
    title: { size: 20px, weight: "600", line-height: "1.4" }
    body: { size: 16px, weight: "400", line-height: "1.5" }
    label: { size: 12px, weight: "600", line-height: "1.2", letter-spacing: 0.05em, text-transform: uppercase }
  font-mono: "ui-monospace — used for Eyebrow 10px mono stamps, not display"
  rules:
    - "Tracking: display -0.02em only for large titles; pick the nearest tracking-step above — ad-hoc tracking-[0.08em] in Hero is the reference."
    - "Weights: 700 for headings/CTAs, 600 for labels, 400 for body copy — no light weights."
    - "Always text-base (16px) on inputs on mobile to prevent iOS zoom — enforced in globals.css base + @media (max-width:639px)."
shape:
  radius-none: 0px
  radius-sm: 4px
  radius-md: 8px
  radius-card: 12px
  radius-inner: 14px
  radius-lg: 16px
  radius-chassis: 20px
  radius-xl: 24px
  radius-full: 9999px
  usage:
    - "4px (sm) — pins + cluster tight surfaces + event tier pill only (leaflet-pin 4px)"
    - "8px (md) — badges, map controls h-11, search thumbs 8px"
    - "12px (card) — ProfileStats compact stats, GameBoardControls dek, gate alerts"
    - "14px (inner) — rows/cards NESTED inside a 16px parent or photo card: Hero inner panels + numbered rows, MarqueeCard, skeleton inner blocks. Never top-level on a page section."
    - "16px (lg) — default card radius: SpotCard, EventCard, SurfaceCard, search rows, toasts, overlay panels, drawer footer cards (relaxed)"
    - "20px (chassis) / 24px (xl) — game PanelShell chassis (20-24) only"
    - "full — all pills, CTAs, tabs, primary buttons, toast action/dismiss"
  literal-map: "rounded-[4px]→rounded-sm · rounded-[8px]→rounded-md · rounded-[12px]→rounded-card · rounded-[14px]→rounded-inner (nested only) · rounded-[16px]→rounded-lg · rounded-[9999px]→rounded-full — no new rounded-[*] literals"
  rule: "Interactive prefers 16px or full. 14px is blessed ONLY as nested-inner. Tight 4/8 only where spec lists — never for primary CTAs or toast containers."
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
  mobile-nav-h: 64px
  note: "Tokens map to Tailwind literals: gap-2=8, gap-4=16, gap-6=24, px-5/gutter=16. Shell chrome shares px-5/md:px-10 margins; BottomNav is fixed 64px (var(--mobile-nav-h)); Header is content-height (py-3.5), not fixed. Toast viewport sits at bottom-[calc(var(--mobile-nav-h)+1rem)] md:bottom-6."
motion:
  durations: "150ms ease-out base (pills, chevrons, NavLink), 300ms image hover scale-102, 500ms hero scale-105, 180ms pin pulse, 2.5s user ping"
  easings: "ease-out default, linear for radar sweep (3.5s), cubic-bezier(0, 0, 0.2, 1) for ping"
  keyframes: "fadeIn 0.3s / slideUp 0.4s / pulseDot 2s / pingSlow 2s / radarSweep 3.5s / heartBurst 600ms / leafletPinPulse 180ms / leafletUserPing 2.5s / ledOn 1.2s / ledBlink 0.6s + panel-scan"
  reduced-motion: "All disabled via @media (prefers-reduced-motion: reduce) — respects useReducedMotion in Toast"
  shadows: "Shadowless by default (shadow-none). Exceptions: PanelShell inset+ 0 8px 24px, MarqueeCard hover:shadow-md + -translate-y-px, hover:shadow-sm on discover cards."
  overlays: "Overlay flush-top: spring damping 30 stiffness 320, 0.18s fade fallback. SideDrawer: spring damping 30 stiffness 320 side slide, backdrop bg-on-surface/50 0.18s. Toast: opacity/y 0.16s easeOut stagger 0.04."
components:
  buttons:
    primary:
      bg: var(--color-primary)
      text: var(--color-on-primary)
      radius: var(--radius-full)
      padding: 12px 24px
      note: "Solid uses primary #0a0a0a (not on-surface #121212). Outline uses border-outline-variant + surface-container-high. EXCEPTION: never place a primary-solid CTA on a dark panel (bg-on-surface) — near-invisible black-on-black (see known-issues.final-cta)."
    accent:
      bg: var(--gradient-primary)
      text: var(--color-on-gradient)
      radius: var(--radius-full)
      padding: 12px 24px
      note: "Accent button only on gradient hero — not repeating UI."
    secondary:
      bg: var(--color-surface-container-high)
      text: var(--color-on-surface)
      radius: var(--radius-full)
  cards:
    bg: var(--color-surface-container-lowest)
    radius: var(--radius-lg)
    border: 1px solid var(--color-outline-variant)
    padding: 16px
    note: "Default card is radius-lg (16px): SpotCard, EventCard, SurfaceCard, search rows. Rows nested INSIDE a 16px card use radius-inner (14px): Hero rider/discover rows, MarqueeCard. No other 14px."
  badges:
    radius: var(--radius-md)
    padding: 4px 8px
    text-style: "label 12px 600 uppercase 0.05em"
    note: "Tones use semantic containers — neutral/info/success vs error. Fix Badge rounded-[8px] literal → rounded-md."
  overlays:
    note: "Exactly two patterns — pick one, never a third. Both lock body scroll, trap focus, close on Escape, honor reduced-motion."
    top-sheet:
      component: "Overlay flush animation=top (SearchOverlay)"
      container: "z-[1300], flush full-bleed column"
      panel: "bg-surface-container-lowest, content max-w-3xl mx-auto p-5 sm:p-6 md:p-8"
      backdrop: "fixed inset-0 bg-on-surface opacity 0.5 — click closes unless gate forced (closeOnBackdrop=false + role=alertdialog)"
      header-row: "search field row radius-lg border-outline-variant bg-surface-container-low; step label (eyebrow) + Close pill (secondary button pattern) right"
    side-drawer:
      component: "SideDrawer side=right (MobileDrawer)"
      container: "z-[1200]"
      panel: "w-90 max-w-[calc(100vw-1rem)] bg-surface-container-lowest text-on-surface — NO border-r on a right-side drawer (see migration-checklist)"
      backdrop: "absolute inset-0 bg-on-surface opacity 0.5"
      header: "BrandLogo + circular h-11 w-11 rounded-full close button (border-outline-variant, never border-on-surface)"
      footer: "border-t border-outline-variant bg-surface-container-low px-5 py-5; Preferences full-width pill; profile card radius-lg"
      rule: "NavLink variants own their own styles — never restyle [data-nav-tab] from the drawer/header parent."
  scrim-pills:
    note: "Pills floating over photography (MarqueeCard kind/meta/title, spot heroes). Blessed exception to monochrome: translucent dark pills on image."
    pill: "rounded-full border border-white/15 bg-on-surface/55 text-surface backdrop-blur-md, micro 9px bold uppercase 0.08em"
    wash: "bg-gradient-to-t from-on-surface/45 via-transparent to-transparent over the image bottom"
    rule: "Scrim pills live on photos only — never on flat surfaces (use badges there)."
  skeleton:
    note: "Loading mirrors of Hero + wire rail (HomeSkeleton). Pulse blocks only, no spinners; keep layout dimensions identical to the loaded component."
    on-light: "animate-pulse rounded bg-surface-container-high (blocks) / bg-surface-container-lowest (inner cards)"
    on-gradient-or-wire: "animate-pulse bg-white/10-25 (never surface tokens — invisible on dark)"
  empty-state:
    note: "Dashed-border centered block for zero results (search no-results). radius-lg border-dashed border-outline-variant bg-surface-container-low, secondary label copy."
  gate-alert:
    note: "Forced-gate notice (search region+country gate). radius-card border + tinted bg + eyebrow title + secondary body — never raw primary/10 black tint (see migration-checklist)."
  toast:
    generic: true
    palette: "Monochrome — same as cards (bg-surface-container-lowest or surface, border-outline-variant, text-on-surface). No per-page tint. Stays generic for all routes."
    container:
      bg: var(--color-surface-container-lowest)
      border: 1px solid var(--color-outline-variant)
      radius: var(--radius-lg)
      shadow: "sm"
      padding: "px-4 py-3"
      note: "Relaxed, not square — replaces current rounded-[4px] border-on-surface. Fresh air via shape, not color. No square corners."
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
    viewport: "fixed bottom-[calc(var(--mobile-nav-h)+1rem)] left-1/2 -translate-x-1/2 z-[1100] w-[min(28rem,calc(100vw-2rem))] gap-2 md:bottom-6"
    motion: "motion/react opacity/y 0.16s easeOut stagger 0.04, useReducedMotion opacity-only"
    a11y: "error tone role=alert aria-live=assertive + border-l-2 or dot may remain but not square; others role=status polite"
    bugfix: "Remove rounded-[4px] everywhere in Toast.tsx:38,71,81,107 → radius-lg/full above. No square."
  pins:
    pin: "See DESIGN_MAP.md — border-map-outline (#c29e99) bg-map-surface-container (#303030) text-map-on-surface (#efefef) radius-sm 4px; active inverts to bg-map-electric (#ff3131) text-on-primary border-map-primary (#ffc4bd) outline 2px map-primary + ambient glow + leafletPinPulse 180ms; saved uses bg-map-surface-container-high (#3b3b3b) text-map-primary border-map-primary + map-primary-container (#ff6b63) corner notch"
    cluster: "See DESIGN_MAP.md — bg-map-surface-container-high (#3b3b3b) text-map-primary (#ffc4bd) border-1.5 border-map-primary-container (#ff6b63) radius-lg 16px 30px chip + ambient glow"
    user: "See DESIGN_MAP.md — crosshair + ring 2.5s ping + dot 10px in map-tertiary (#82ddf7 cyan) with 2px map-tertiary-fixed (#c4f0ff) border + cyan glow; nearby radius circle uses #82ddf7 / #36b1d0"
    event: "See DESIGN_MAP.md — tier 8px 4px radius bg-map-surface-container-low (#2b2b2b) border-map-outline (#c29e99) text-map-on-surface-variant (#f0ccc9); square 88-132px 4px radius bg-map-surface-container (#303030) text-map-on-surface border-map-primary-container (#ff6b63) (active bg-map-electric #ff3131 outline 2px map-primary #ffc4bd); status dot live (#ff3131)/upcoming (#ffc4bd)/completed (#d6d4d3) by form"
  panel:
    chassis: "radius-chassis 20px border 1.5px on-surface bg-surface-container-high + inset highlight"
    screen: "radial highlight + 0 2px 12px shadow, CRT scanline 0.035 (hidden on reduced-motion)"
    deck: "surface-container + border-top outline-variant"
known-issues:
  final-cta-contrast:
    severity: "must-fix"
    where: "src/components/landing/FinalCta.tsx:14,35"
    problem: "Dark panel bg-on-surface (#121212) with Heart icon text-primary (#0a0a0a, near-invisible) and primary-solid CTA bg-primary (#0a0a0a on #121212, black-on-black)."
    fix: "Eyebrow icon → text-accent-start; primary CTA → keep pill shape but bg-surface-container-lowest text-on-surface, OR gradient accent bg-gradient-primary text-on-gradient. Never primary-solid on on-surface panels."
guidelines:
  - "Monochrome is the system (surface ladder #f7f9fb → #ffffff → #e7eaee). Color only via blessed washes in pages.* plus permission/activity LEDs — photos/maps stay the focus."
  - "All maps across the entire site (LeafletCanvas, SpotStaticMap, SpotMapFallback) use the dedicated high-contrast dark palette in DESIGN_MAP.md (--color-map-* tokens and --map-tile-filter on .leaflet-tile-pane / .map-tile-dark) ONLY for the map canvas, tiles, and on-map markers/overlays; surrounding page shells, layouts, sidebars, and cards stay light monochrome."
  - "One wash per route, picked from pages.* only — never invent a new from-*/via-* gradient. Use var(--gradient-*) or bg-gradient-*."
  - "Reserve #0a0a0a (primary — pure black) strictly for CTAs, active nav, critical states, pins active, wire rail. Never on dark panels (see known-issues)."
  - "Use relaxed 16px (radius-lg) or full for interactive; 14px (radius-inner) only for rows/cards nested inside a 16px parent. No new rounded-[*] literals — use the shape.literal-map."
  - "On wire surfaces use wire-* tokens, never white/* literals. On photos use scrim-pills. The two never mix."
  - "Overlays: pick top-sheet OR side-drawer from components.overlays — never a third pattern, never restyle NavLink from a parent."
  - "Keep type high-contrast (Plus Jakarta Sans bold/600, tight tracking) for outdoor glare. Mono only for Eyebrow stamps."
  - "Shadows are the exception, not the rule — Panel chassis + Marquee hover are the only 8-24px + shadow sits. Else flat border."
  - "New pages/sections must declare their pages.* entry first — if not listed, default to surface monochrome."
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
migration-checklist:
  # DESIGN.md-only scope: components untouched. Work through top to bottom.
  - "gradient-token: Hero.tsx:27 + HomeSkeleton.tsx:12 `bg-gradient-to-r from-orange-600 via-red-600 to-red-700` → `bg-gradient-primary`; drop stray `py-auto` (Hero.tsx:27, invalid no-op)."
  - "wire-tokens: LandingMarquee.tsx:210,248-266 `text-white/border-white/15/bg-white/10-15` → on-wire/wire-border/wire-border-strong/wire-muted per colors mapping above. Keep ring-white focus rings + from-wire edge fades."
  - "final-cta: apply known-issues.final-cta-contrast fix (icon + CTA tokens)."
  - "drawer: MobileDrawer.tsx:65 remove `border-r` (right-side drawer); :75 `border-on-surface` → `border-outline-variant`; :81 delete `[&_[data-nav-tab]]` parent overrides (move into NavLink mobile-drawer variant); :69/:143/:151/:168/:174 `rounded-[16px]/[9999px]` → rounded-lg/full."
  - "search: SearchOverlay.tsx:244 delete bogus `focus:true` class; :284 gate alert `border-primary/20 bg-primary/10` → radius-card + surface tint per gate-alert; radius literals → shape.literal-map."
  - "headers: Header.tsx:27 drop `[&_[data-nav-tab]]` parent overrides (rounded/selected styles belong in NavLink desktop variant)."
  - "badges: Badge `rounded-[8px]` literal → `rounded-md` (unchanged from prior spec, still open)."
  - "skeleton: HomeSkeleton gradient/wire blocks already use bg-white/* correctly — no change; only the hero wash literal (item 1)."
---
