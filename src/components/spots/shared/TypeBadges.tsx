import { cn } from "@/lib/utils/cn";
import type { SpotTypeRef } from "@/lib/types";

/**
 * Visual variants:
 * - `"overlay"` is for image/hero overlays (dark label on light/dark image).
 * - `"surface"` is for on-surface contexts (map popup, search overlay,
 *   map sidebar list cells) — uses a tinted background.
 * - `"ghost"` is for monochrome dense tables (admin) — no background,
 *   just an uppercase mono label, separated by a separator dot.
 */
export type TypeBadgeVariant = "overlay" | "surface" | "ghost";

interface TypeBadgesProps {
  types: readonly SpotTypeRef[];
  variant?: TypeBadgeVariant;
  /** `md` is the larger photo-hero label (spot detail); `sm` everywhere else. */
  size?: "sm" | "md";
  className?: string;
}

const OVERLAY_CLASSES =
  "inline-block rounded-control bg-on-surface/60 px-2 py-0.5 font-display text-[9px] font-bold uppercase tracking-label text-surface";
const OVERLAY_MD_CLASSES =
  "inline-flex items-center rounded-control border border-white/15 bg-on-surface/55 px-3 py-1 font-display text-xs font-bold uppercase tracking-label text-surface backdrop-blur-md";
const SURFACE_CLASSES =
  "inline-block rounded-control bg-primary/10 px-2 py-0.5 font-display text-[9px] font-bold uppercase tracking-label text-primary";
const GHOST_CLASSES =
  "font-display text-[9px] font-semibold text-secondary uppercase";

/**
 * Renders a row of type labels for a spot. Caller picks the variant;
 * we never derive it from context so the design stays explicit.
 * Returns `null` when the spot has no types so callers can drop the
 * row entirely.
 */
export function TypeBadges({
  types,
  variant = "surface",
  size = "sm",
  className,
}: TypeBadgesProps) {
  if (types.length === 0) return null;
  if (variant === "ghost") {
    return (
      <span className={cn("flex flex-wrap", className)} aria-label="Spot types">
        {types.map((t, idx) => (
          <span key={t.slug} className={GHOST_CLASSES}>
            {t.name}
            {idx < types.length - 1 ? (
              <span aria-hidden="true" className="ml-1 text-outline">
                ·
              </span>
            ) : null}
          </span>
        ))}
      </span>
    );
  }
  const pillClasses =
    variant === "overlay"
      ? size === "md"
        ? OVERLAY_MD_CLASSES
        : OVERLAY_CLASSES
      : SURFACE_CLASSES;
  return (
    <ul
      className={cn("flex flex-wrap items-center gap-1", className)}
      aria-label="Spot types"
    >
      {types.map((t) => (
        <li key={t.slug}>
          <span aria-label={`Type: ${t.name}`} className={pillClasses}>
            {t.name}
          </span>
        </li>
      ))}
    </ul>
  );
}
