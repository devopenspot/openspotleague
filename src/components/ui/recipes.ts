/**
 * Class recipes — the single source for the shared visual grammar
 * (DESIGN.md `shape.rule`, `components.controls`, `typography.recipes`).
 *
 * Shape rule:
 *   - Controls (buttons, inputs, selects, pills, chips, tabs, tags, icon
 *     buttons) are `rounded-control` (full) and `h-control` (44px). Buttons
 *     match inputs: same height, same 1px border.
 *   - Containers (cards, panels, fieldsets, textareas, empty states) are
 *     `rounded-container` (16px); nested containers `rounded-inner` (14px);
 *     small tiles `rounded-card` (12px).
 *
 * `cn` does not merge Tailwind classes, so never override a recipe's
 * radius/height/colour from the call site — pick a variant instead. Every
 * string is spelled in full so Tailwind's scanner sees it.
 */

/* ───────────────────────── Controls ───────────────────────── */

export type ControlTone =
  | "primary"
  | "secondary"
  | "outline"
  | "onWash"
  | "onWashDark"
  | "onWire"
  | "onWireOutline"
  | "onPhoto";

export type ControlSize = "md" | "sm";

const CONTROL_SHAPE =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-control border font-display font-bold uppercase tracking-pill transition-[background-color,border-color,color,opacity,transform] duration-150 ease-out active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60";

const CONTROL_SIZE: Record<ControlSize, string> = {
  md: "min-h-control px-5 text-xs",
  sm: "min-h-control-sm px-4 text-[11px]",
};

const ICON_SIZE: Record<ControlSize, string> = {
  md: "h-control w-control",
  sm: "h-control-sm w-control-sm",
};

/** Colour per surface. Dark surfaces carry their own white focus outline. */
const CONTROL_TONE: Record<ControlTone, string> = {
  primary: "border-primary bg-primary text-on-primary hover:bg-primary/90",
  secondary:
    "border-outline-variant bg-surface-container-high text-on-surface hover:border-outline",
  outline:
    "border-outline-variant bg-surface-container-lowest text-on-surface hover:border-outline hover:bg-surface-container-low",
  onWash:
    "border-on-surface bg-surface-container-lowest text-on-surface hover:bg-surface-container-high",
  onWashDark:
    "border-on-primary-container bg-on-primary-container text-on-primary hover:bg-on-primary-container/90 focus-visible:outline-white",
  onWire:
    "border-on-wire bg-on-wire text-wire hover:bg-on-wire/90 focus-visible:outline-white",
  onWireOutline:
    "border-wire-border-strong bg-wire-border text-on-wire hover:bg-wire-border-strong focus-visible:outline-white",
  onPhoto:
    "border-white/15 bg-on-surface/55 text-surface backdrop-blur-md hover:bg-on-surface/70 focus-visible:outline-white",
};

/** Pill button / link. */
export function controlClass(
  tone: ControlTone = "primary",
  size: ControlSize = "md",
): string {
  return `${CONTROL_SHAPE} ${CONTROL_SIZE[size]} ${CONTROL_TONE[tone]}`;
}

/** Circular icon-only button (search, menu, close, share…). */
export function iconButtonClass(
  tone: ControlTone = "outline",
  size: ControlSize = "md",
): string {
  return `inline-flex shrink-0 items-center justify-center rounded-control border transition-[background-color,border-color,color,transform] duration-150 ease-out active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60 ${ICON_SIZE[size]} ${CONTROL_TONE[tone]}`;
}

/** Text input / select. Same height and radius as a button; 16px on mobile. */
export const INPUT =
  "min-h-control w-full rounded-control border border-outline-variant bg-surface-container-lowest px-4 text-base text-on-surface placeholder:text-secondary transition-colors hover:border-outline sm:text-sm";

export const INPUT_ON_WIRE =
  "min-h-control w-full rounded-control border border-wire-border-strong bg-wire-border px-4 text-base text-on-wire placeholder:text-wire-muted transition-colors hover:border-wire-muted focus-visible:outline-white sm:text-sm";

/** Multi-line text is a container, not a control. */
export const TEXTAREA =
  "w-full rounded-container border border-outline-variant bg-surface-container-lowest px-4 py-3 text-base text-on-surface placeholder:text-secondary sm:text-sm";

/* ───────────────────────── Chips, tags, segments ───────────────────────── */

const CHIP_SHAPE =
  "inline-flex min-h-control-sm shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-control border px-3.5 font-display text-xs font-bold uppercase tracking-label transition-colors duration-150 ease-out";

/** Selectable filter chip (role=tab / aria-pressed). */
export function chipClass(
  active: boolean,
  surface: "light" | "wire" = "light",
): string {
  if (surface === "wire") {
    return `${CHIP_SHAPE} focus-visible:outline-white ${
      active
        ? "border-on-wire bg-on-wire text-wire"
        : "border-wire-border-strong bg-transparent text-on-wire hover:bg-wire-border"
    }`;
  }
  return `${CHIP_SHAPE} ${
    active
      ? "border-primary bg-primary text-on-primary"
      : "border-outline-variant bg-surface-container-lowest text-on-surface hover:border-outline"
  }`;
}

export type TagTone = "neutral" | "outline" | "solid" | "onWire" | "onPhoto";

const TAG_TONE: Record<TagTone, string> = {
  neutral: "border-transparent bg-surface-container-high text-secondary",
  outline: "border-outline-variant bg-transparent text-secondary",
  solid: "border-primary bg-primary text-on-primary",
  onWire: "border-wire-border-strong bg-wire-border text-on-wire",
  onPhoto: "border-white/15 bg-on-surface/55 text-surface backdrop-blur-md",
};

/** Non-interactive label (status, role, count, scope). */
export function tagClass(tone: TagTone = "neutral"): string {
  return `inline-flex items-center gap-1 whitespace-nowrap rounded-control border px-2.5 py-1 font-display text-[10px] font-bold uppercase leading-none tracking-label ${TAG_TONE[tone]}`;
}

/** Segmented tabs: a full-radius track with an inverted active pill (same idea as the nav). */
export const SEGMENTED_TRACK =
  "flex items-center gap-1 overflow-x-auto no-scrollbar rounded-control bg-surface-container-lowest p-1 ring-1 ring-inset ring-outline-variant";

export function segmentClass(active: boolean): string {
  return `inline-flex min-h-control-sm flex-1 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-control px-4 font-display text-xs font-bold uppercase tracking-pill transition-colors duration-150 ease-out ${
    active
      ? "bg-primary text-on-primary"
      : "text-secondary hover:bg-surface-container hover:text-on-surface"
  }`;
}

/* ───────────────────────── Typography ───────────────────────── */

/** Small label above a title. Use EYEBROW_ON_WIRE on dark rails. */
export const EYEBROW =
  "font-display text-xs font-bold uppercase leading-tight tracking-eyebrow text-secondary";
export const EYEBROW_ON_WIRE =
  "font-display text-xs font-bold uppercase leading-tight tracking-eyebrow text-wire-muted";

/** Page h1. No colour — add text-on-surface / text-surface at the call site. */
export const PAGE_TITLE =
  "font-display text-2xl font-bold uppercase leading-tight tracking-display sm:text-4xl";

/** Section h2. No colour. */
export const SECTION_TITLE =
  "font-display text-xl font-bold uppercase leading-tight tracking-tight sm:text-2xl";

/** Card / panel heading. No colour. */
export const CARD_TITLE =
  "font-display text-lg font-bold uppercase leading-tight tracking-tight";

/** Dense uppercase meta line (counts, dates, scopes) — quieter than EYEBROW. */
export const META =
  "font-display text-xs font-semibold uppercase leading-tight tracking-label text-secondary";

/** Stat / field label. */
export const LABEL =
  "font-display text-[10px] font-bold uppercase leading-tight tracking-label text-secondary";

export const BODY = "text-sm leading-relaxed text-on-surface-variant";

/* ───────────────────────── Containers ───────────────────────── */

/** Card frame without padding (for media cards and lists that bleed). */
export const CARD_FRAME =
  "rounded-container border border-outline-variant bg-surface-container-lowest";

export const CARD = `${CARD_FRAME} p-4 sm:p-5`;

/** Row or block nested inside a 16px card. */
export const CARD_NESTED =
  "rounded-inner border border-outline-variant bg-surface-container-low p-4";

/** Small stat / glance tile. */
export const TILE =
  "rounded-card border border-outline-variant bg-surface-container px-3 py-3";

export const EMPTY_STATE =
  "rounded-container border border-dashed border-outline-variant bg-surface-container-low px-5 py-10 text-center";

/** Dark-rail panel (TV, wire). */
export const PANEL_ON_WIRE =
  "rounded-container border border-wire-border bg-tv-overlay";

export function alertClass(tone: "neutral" | "error" = "neutral"): string {
  return `rounded-card border p-4 ${
    tone === "error"
      ? "border-error/30 bg-error-container/40 text-on-error-container"
      : "border-outline-variant bg-surface-container-low text-on-surface"
  }`;
}

/* ───────────────────────── Layout ───────────────────────── */

export type PageWidth = "3xl" | "5xl" | "6xl" | "7xl";

const PAGE_WIDTH: Record<PageWidth, string> = {
  "3xl": "max-w-3xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
};

/** Page column: shared shell gutter (px-5 / md:px-10) and optional vertical rhythm. */
export function pageContainer(
  width: PageWidth = "6xl",
  { padY = true }: { padY?: boolean } = {},
): string {
  return `mx-auto w-full ${PAGE_WIDTH[width]} px-5 md:px-10${
    padY ? " py-8 md:py-10" : ""
  }`;
}
