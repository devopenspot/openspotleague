export const PROFILE_EYEBROW_CLASS =
  "font-display text-xs font-semibold uppercase tracking-[0.05em] text-secondary";
export const PROFILE_BODY_CLASS =
  "text-sm font-semibold leading-5 text-secondary";
export const PROFILE_CARD_TITLE_CLASS =
  "font-display text-xl font-bold uppercase leading-[1.3] tracking-[-0.02em]";

const PROFILE_BUTTON_BASE_CLASS =
  "inline-flex min-h-12 shrink-0 items-center justify-center rounded-lg border-2 px-4 font-display text-sm font-bold uppercase tracking-[0.04em] transition-[background-color,transform] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 active:translate-y-px";
export const PROFILE_BUTTON_CLASS = `${PROFILE_BUTTON_BASE_CLASS} border-on-surface text-on-surface hover:bg-surface-container-high`;
export const PROFILE_BUTTON_PRIMARY_CLASS = `${PROFILE_BUTTON_BASE_CLASS} border-primary bg-primary text-on-primary hover:bg-primary/90`;

export const PROFILE_SEGMENTS_CLASS =
  "flex overflow-hidden rounded-lg border-2 border-outline-variant bg-surface-container";

const PROFILE_SEGMENT_BASE_CLASS =
  "inline-flex h-11 shrink-0 items-center justify-center gap-1 border-l border-outline-variant px-2 font-display text-xs font-bold uppercase tracking-[0.04em] transition-colors first:border-l-0 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset sm:px-3 sm:text-sm";

export function profileSegmentClass(active: boolean): string {
  return `${PROFILE_SEGMENT_BASE_CLASS} ${
    active
      ? "bg-primary text-on-primary"
      : "text-secondary hover:bg-surface-container-high hover:text-on-surface"
  }`;
}
