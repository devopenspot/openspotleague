---
name: map theme
colors:
  surface: "#242424"
  surface-dim: "#1f1f1f"
  surface-bright: "#4d4d4d"
  surface-container-lowest: "#1b1b1b"
  surface-container-low: "#2b2b2b"
  surface-container: "#303030"
  surface-container-high: "#3b3b3b"
  surface-container-highest: "#474747"
  on-surface: "#efefef"
  on-surface-variant: "#f0ccc9"
  inverse-surface: "#efefef"
  inverse-on-surface: "#3d3d3d"
  outline: "#c29e99"
  outline-variant: "#75524e"
  surface-tint: "#ffc4bd"
  primary: "#ffc4bd"
  on-primary: "#690006"
  primary-container: "#ff6b63"
  on-primary-container: "#5c0005"
  inverse-primary: "#c00014"
  secondary: "#d6d4d3"
  on-secondary: "#3d3c3c"
  secondary-container: "#595958"
  on-secondary-container: "#cecccb"
  tertiary: "#82ddf7"
  on-tertiary: "#003642"
  tertiary-container: "#36b1d0"
  on-tertiary-container: "#002e3a"
  error: "#ffc4bd"
  on-error: "#690005"
  error-container: "#93000a"
  on-error-container: "#ffdad6"
  primary-fixed: "#ffdad6"
  primary-fixed-dim: "#ffc4bd"
  on-primary-fixed: "#410002"
  on-primary-fixed-variant: "#93000c"
  secondary-fixed: "#eceae9"
  secondary-fixed-dim: "#d6d4d3"
  on-secondary-fixed: "#262525"
  on-secondary-fixed-variant: "#595958"
  tertiary-fixed: "#c4f0ff"
  tertiary-fixed-dim: "#82ddf7"
  on-tertiary-fixed: "#001f27"
  on-tertiary-fixed-variant: "#004e5f"
  background: "#242424"
  on-background: "#efefef"
  surface-variant: "#474747"
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: "800"
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: "700"
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: "700"
    lineHeight: 36px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: "700"
    lineHeight: 32px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: "400"
    lineHeight: 28px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: "400"
    lineHeight: 24px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: "600"
    lineHeight: 20px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: "500"
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  header-height: 64px
  nav-height: 64px
  container-margin: 20px
  gutter: 16px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style

The design system is built on a **Retro-Futuristic "Neon Tokyo"** aesthetic (lifted by 20% in luminance for optimal map legibility), blending the high-energy atmosphere of street sports with a cinematic, cyberpunk-inspired digital interface. The experience is designed to feel immersive, fast-paced, and authoritative.

The style leverages **High-Contrast Minimalism** with a strictly controlled color palette. By using a lifted dark charcoal foundation (`#1b1b1b`–`#242424`) and reserving the electric accent for critical interactions, the map UI creates a sense of "night-mode" intensity without crushing road, block, and terrain details. The aesthetic borrows from **Glassmorphism** for surface overlays and **Brutalism** for its bold, unapologetic use of scale and borders, resulting in a look that is both premium and underground.

## Colors

The palette is anchored in a **Lifted Charcoal Base (+20% luminance)** so map roads, blocks, and markers remain effortlessly readable across all screens.

- **Primary (#ff3131 / #ffc4bd):** "Electric Red" (`#ff3131`) is the sole driver of action for active pins, live match indicators, and critical alerts, paired with luminous salmon (`#ffc4bd`) and coral (`#ff6b63`) accents.
- **Background:** Lifted charcoal (`#1b1b1b` lowest canvas / `#242424` base surface, paired with `--map-tile-filter: grayscale(100%) invert(100%) contrast(85%) brightness(125%)`) prevents crushed blacks while preserving the "Tokyo at night" feel.
- **Surfaces:** Use elevated charcoal (`#2b2b2b` to `#3b3b3b`) for pins, clusters, and map controls to create clear separation against the dark map tiles.
- **Typography:** High-emphasis text uses crisp off-white (`#efefef`). Medium-emphasis and metadata use warm light gray (`#d6d4d3`) and rose-tinted gray (`#f0ccc9`) to maintain a clear hierarchy.

## Typography

The typography utilizes **Plus Jakarta Sans** across all levels to maintain a modern, geometric, and clean look.

- **Headlines:** Utilize heavy weights (Bold/ExtraBold) with tight letter spacing for a high-impact, editorial feel.
- **Labels:** Small labels and utility text should be set in SemiBold with slight tracking (letter spacing) and uppercase styling to evoke technical "UI Chrome" found in futuristic displays.
- **Body:** Keep body text clean and legible with standard weights.
- **Mobile Scaling:** Display and Large Headlines scale down on mobile to ensure content density remains high without sacrificing the bold brand voice.

## Layout & Spacing

This design system uses a **Fluid Grid** model with strict horizontal constraints.

- **UI Chrome:** Both the top header and bottom navigation are fixed at 64px height. This creates a balanced frame for the content.
- **Safe Areas:** A consistent horizontal margin of 20px (px-5) is applied to all main views to prevent content from touching the screen edges.
- **Grid Model:** A 12-column grid is used for desktop, collapsing to a single column on mobile. Gutters are kept at 16px to maintain a compact, "data-rich" environment.
- **Vertical Rhythm:** Spacing between elements follows a base-8 scale (8px, 16px, 32px, 64px) to ensure mathematical harmony across the app.

## Elevation & Depth

In a dark charcoal environment, depth is achieved through **Tonal Layering** and **High-Contrast Outlines** rather than traditional shadows.

- **Layering:** The base map canvas layer is `#1b1b1b` (`surface-container-lowest`) / `#242424` (`surface`). Elements that sit "above" the base use `#303030` (`surface-container`) and `#3b3b3b` (`surface-container-high`).
- **Borders:** Use crisp 1px solid borders (`#75524e` `outline-variant` and `#c29e99` `outline`) to define the edges of markers and controls. This creates a "grid" or "blueprint" feel.
- **Glassmorphism:** For floating map attribution or overlays, use a background blur with an 85%–88% opacity version of the surface color (`#242424`) to maintain context of what is behind the UI.
- **Glow:** Reserve soft, primary-colored outer glows (`#ff3131` at 25%–35% opacity) exclusively for "Live" match indicators, clusters, or active marker states.

## Shapes

The shape language is bold and friendly, contrasting the sharp "tech" colors with soft, organic containers.

- **Standard Radius:** 16px (rounded-lg) is the default for all content cards, modals, and input fields.
- **Interactive Radius:** Buttons and chips use a **Pill-shaped (Full)** radius to differentiate interactive elements from static containers.
- **Consistency:** Avoid mixing sharp corners with rounded corners. If a container is nested inside another, ensure the inner radius is mathematically smaller to maintain visual concentricity.

## Components

- **Buttons:** Primary buttons are pill-shaped, `#ff3131` background with white text. Secondary buttons are outlined in `#c29e99` with a `#303030` background.
- **Input Fields:** Elevated charcoal background (`#303030`), 16px radius, with a `#75524e` border. On focus, the border transitions to `#ff3131`.
- **Map Pins & Cards:** Use a `#303030` surface with a `#c29e99` border for default pins and `#3b3b3b` with `#ffc4bd` / `#ff6b63` borders for saved and cluster states.
- **Chips/Badges:** Small, tight or pill-shaped elements. For "Live" or active status, use `#ff3131` with a pulsing animation. For category/date tags, use `#595958` (`secondary-container`) with `#d6d4d3` text.
- **Telemetry / User Location:** Use `#82ddf7` (`tertiary`) and `#36b1d0` (`tertiary-container`) with `#c4f0ff` (`tertiary-fixed`) highlights for user location crosshairs, ping rings, and nearby radius overlays.
- **Match Lists:** High-density rows with vertical dividers. Team logos should be treated as the primary visual anchor in these lists.
