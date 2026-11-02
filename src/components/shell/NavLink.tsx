"use client";

import Link from "next/link";
import type { MouseEventHandler, ReactNode } from "react";
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
}

const VARIANT_STYLES: Record<
  NavVariant,
  { base: string; active: string; inactive: string }
> = {
  desktop: {
    base: "flex min-h-12 items-center space-x-2 rounded-lg px-3 font-display text-sm font-bold uppercase tracking-[0.04em] transition-[background-color,color,transform] focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 active:translate-y-px",
    active: "border-b-2 border-on-wire bg-wire-border/50 text-on-wire",
    inactive: "text-wire-muted hover:bg-wire-border hover:text-on-wire",
  },
  // radius-lg 16px per DESIGN.md — interactive controls are 16px or full.
  "mobile-tab": {
    base: "flex min-h-14 min-w-14 flex-col items-center justify-center space-y-1 rounded-lg border-b-2 px-3 font-display text-xs font-semibold uppercase tracking-[0.05em] transition-[background-color,color,transform] focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 active:translate-y-px",
    active: "border-on-wire bg-wire-border/50 text-on-wire",
    inactive: "border-transparent text-wire-muted hover:text-on-wire",
  },
  "mobile-drawer": {
    base: "flex min-h-12 w-full items-center justify-between border-b-1 px-4 font-display text-sm font-bold uppercase tracking-[0.04em] transition-colors",
    active: "bg-primary text-on-primary border-primary",
    inactive:
      "border-outline-variant/60 bg-surface-container-low hover:border-outline text-secondary hover:text-on-surface",
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
      className={cn(
        styles.base,
        active ? styles.active : styles.inactive,
        className,
      )}
    >
      <span
        className={cn(
          "flex items-center",
          variant === "mobile-tab" ? "flex-col space-y-1" : "space-x-2",
        )}
      >
        {overlay ? (
          <span className="relative inline-flex">
            <span aria-hidden="true" className="shrink-0">
              {icon}
            </span>
            <span className="absolute -top-1.5 -right-2 flex items-center justify-center">
              {badge}
            </span>
          </span>
        ) : (
          <span className="relative inline-flex">
            <span aria-hidden="true" className="shrink-0">
              {icon}
            </span>
            {badge && <span className="ml-2 flex items-center">{badge}</span>}
          </span>
        )}
        <span>{label}</span>
      </span>
    </Link>
  );
}
