"use client";

import Link from "next/link";
import type {
  FocusEventHandler,
  MouseEventHandler,
  PointerEventHandler,
  ReactNode,
  TouchEventHandler,
} from "react";
import { cn } from "@/lib/utils/cn";
import type { TabType } from "@/lib/types";

export type NavVariant = "desktop" | "mobile-tab" | "mobile-drawer";

interface NavLinkProps {
  tab: TabType;
  href: string;
  label: string;
  icon: ReactNode;
  badge?: ReactNode;
  active: boolean;
  variant: NavVariant;
  className?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  /** Navigation-intent hooks (warm a route before the click lands). */
  onPointerEnter?: PointerEventHandler<HTMLAnchorElement>;
  onTouchStart?: TouchEventHandler<HTMLAnchorElement>;
  onFocus?: FocusEventHandler<HTMLAnchorElement>;
}

/**
 * "Pill track" nav (DESIGN.md components.nav). One language on every
 * breakpoint: inactive items are muted text on the black chrome, the active
 * item is an inverted white pill. Desktop items sit in a rounded-full track,
 * the bottom bar puts the pill behind the icon, drawer rows are full pills.
 */
const VARIANT_STYLES: Record<
  NavVariant,
  { base: string; active: string; inactive: string }
> = {
  desktop: {
    base: "inline-flex min-h-control-sm items-center gap-2 rounded-control px-4 font-display text-xs font-bold uppercase tracking-pill transition-[background-color,color,transform] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 active:translate-y-px",
    active: "bg-on-wire text-wire",
    inactive: "text-wire-muted hover:bg-wire-border-strong hover:text-on-wire",
  },
  "mobile-tab": {
    base: "group flex min-h-14 min-w-14 flex-1 flex-col items-center justify-center gap-1 rounded-control font-display text-[11px] font-semibold uppercase tracking-label transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-white focus-visible:-outline-offset-2",
    active: "text-on-wire",
    inactive: "text-wire-muted hover:text-on-wire",
  },
  "mobile-drawer": {
    base: "flex min-h-control w-full items-center justify-between gap-3 rounded-control px-4 font-display text-sm font-bold uppercase tracking-dense transition-[background-color,color,transform] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 active:translate-y-px",
    active: "bg-on-wire text-wire",
    inactive: "bg-wire-border text-on-wire hover:bg-wire-border-strong",
  },
};

const badgeOverlaysIcon = (variant: NavVariant) => variant !== "mobile-drawer";

export function NavLink({
  tab,
  href,
  label,
  icon,
  badge,
  active,
  variant,
  className,
  onClick,
  onPointerEnter,
  onTouchStart,
  onFocus,
}: NavLinkProps) {
  const styles = VARIANT_STYLES[variant];
  const overlay = badgeOverlaysIcon(variant) && badge;

  return (
    <Link
      // The header link is the only one with an id: the header and bottom nav
      // render the same items, and pages label themselves with `nav-btn-*`.
      id={variant === "desktop" ? `nav-btn-${tab}` : undefined}
      href={href}
      prefetch={false}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      onPointerEnter={onPointerEnter}
      onTouchStart={onTouchStart}
      onFocus={onFocus}
      className={cn(
        styles.base,
        active ? styles.active : styles.inactive,
        className,
      )}
    >
      {variant === "mobile-tab" ? (
        <>
          <span
            className={cn(
              "relative flex h-8 w-14 items-center justify-center rounded-control transition-colors duration-150 ease-out",
              active ? "bg-on-wire text-wire" : "group-hover:bg-wire-border",
            )}
          >
            <span aria-hidden="true" className="shrink-0">
              {icon}
            </span>
            {overlay ? (
              <span className="absolute -top-1 right-2 flex items-center justify-center">
                {badge}
              </span>
            ) : null}
          </span>
          <span>{label}</span>
        </>
      ) : (
        <span className="flex min-w-0 items-center gap-2">
          <span className="relative inline-flex">
            <span aria-hidden="true" className="shrink-0">
              {icon}
            </span>
            {overlay ? (
              <span className="absolute -top-1.5 -right-2 flex items-center justify-center">
                {badge}
              </span>
            ) : null}
          </span>
          <span>{label}</span>
          {badge && !overlay ? (
            <span className="flex items-center">{badge}</span>
          ) : null}
        </span>
      )}
    </Link>
  );
}
