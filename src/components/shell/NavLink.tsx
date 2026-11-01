"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import type { TabType } from "@/lib/types";

export type NavVariant = "desktop" | "mobile-tab" | "mobile-drawer";

interface NavLinkProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "id" | "type"
> {
  tab: TabType;
  label: string;
  icon: ReactNode;
  badge?: ReactNode;
  active: boolean;
  variant: NavVariant;
  controlsId?: string;
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
    base: "flex min-h-14 flex-col items-center justify-center space-y-1 px-5 text-[10px] font-medium transition-colors",
    active: "text-primary",
    inactive: "text-secondary",
  },
  "mobile-drawer": {
    base: "flex min-h-12 w-full items-center justify-between border-b-1 px-4 font-display text-sm font-bold uppercase tracking-[0.04em] transition-colors",
    active: "bg-primary text-on-primary border-primary",
    inactive:
      "border-outline-variant/60 bg-surface-container-low hover:border-outline text-secondary hover:text-on-surface",
  },
};

const badgeOverlaysIcon = (variant: NavVariant) => variant !== "mobile-drawer";

export const NavLink = forwardRef<HTMLButtonElement, NavLinkProps>(
  function NavLink(
    {
      tab,
      label,
      icon,
      badge,
      active,
      variant,
      controlsId,
      className,
      onClick,
      ...rest
    },
    ref,
  ) {
    const styles = VARIANT_STYLES[variant];
    const isTab = variant !== "mobile-drawer";
    const overlay = badgeOverlaysIcon(variant) && badge;

    return (
      <button
        ref={ref}
        id={`nav-btn-${tab}`}
        type="button"
        role={isTab ? "tab" : undefined}
        aria-selected={isTab ? active : undefined}
        aria-current={
          variant === "mobile-drawer"
            ? active
              ? "page"
              : undefined
            : undefined
        }
        aria-controls={isTab ? controlsId : undefined}
        tabIndex={isTab ? (active ? 0 : -1) : undefined}
        data-nav-tab={tab}
        onClick={onClick}
        className={cn(
          styles.base,
          active ? styles.active : styles.inactive,
          className,
        )}
        {...rest}
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
      </button>
    );
  },
);
