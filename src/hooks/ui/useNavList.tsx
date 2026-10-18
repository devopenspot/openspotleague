"use client";

import { useCallback, useMemo, useRef, type KeyboardEvent } from "react";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, type NavPlacement, type NavGroup } from "@/lib/navigation/nav";
import { useUser } from "@/lib/contexts/user-context";
import type { NavVariant } from "@/components/shell/NavLink";

export const NAV_GROUP_ORDER: readonly NavGroup[] = [
  "discover",
  "play",
  "you",
  "meta",
  "curator",
] as const;

export const NAV_GROUP_LABELS: Record<NavGroup, string> = {
  discover: "Discover",
  play: "Play",
  you: "You",
  meta: "Support",
  curator: "Curation",
};

function placementForVariant(variant: NavVariant): NavPlacement {
  if (variant === "desktop") return "header";
  if (variant === "mobile-tab") return "bottom";
  return "drawer";
}

interface UseNavListOptions {
  variant: NavVariant;
  onSelect: (path: string) => void;
}

export function useNavList({ variant, onSelect }: UseNavListOptions) {
  const pathname = usePathname();
  const listRef = useRef<HTMLDivElement>(null);
  const user = useUser();

  // Placement + auth/curator filtering. Placement is the primary distribution
  // mechanism per the IA: header (desktop pills), bottom (mobile tab), drawer (grouped).
  const navItems = useMemo(() => {
    const placement = placementForVariant(variant);
    return NAV_ITEMS.filter(
      (item) =>
        item.placements.includes(placement) &&
        (!item.adminOnly || user?.canAccessAdmin === true) &&
        (!item.curationOnly || user?.canCurate === true) &&
        (!item.authOnly || user !== null),
    );
  }, [user, variant]);

  const handleSelect = useCallback(
    (path: string) => () => onSelect(path),
    [onSelect],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const isTabVariant = variant !== "mobile-drawer";
      const allowedKeys = isTabVariant
        ? ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"]
        : ["ArrowUp", "ArrowDown", "Home", "End"];
      if (!allowedKeys.includes(e.key)) return;
      const buttons = Array.from(
        listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ??
          [],
      );
      if (buttons.length === 0) return;
      const currentIndex = buttons.findIndex(
        (b) => b === document.activeElement,
      );
      let nextIndex = currentIndex;
      if (e.key === "Home") nextIndex = 0;
      else if (e.key === "End") nextIndex = buttons.length - 1;
      else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        nextIndex = (currentIndex + 1) % buttons.length;
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        nextIndex = (currentIndex - 1 + buttons.length) % buttons.length;
      }
      e.preventDefault();
      buttons[nextIndex]?.focus();
    },
    [variant],
  );

  return { pathname, listRef, handleSelect, handleKeyDown, navItems };
}

interface RenderBadgeArgs {
  variant: NavVariant;
  id: string;
  savedCount: number;
}

export function renderNavBadge({ variant, id, savedCount }: RenderBadgeArgs) {
  if (id !== "saved" || savedCount <= 0) return undefined;
  if (variant === "mobile-drawer") {
    return (
      <span
        aria-label={`${savedCount} spots saved`}
        className="rounded-md bg-primary px-2 py-1 text-[9px] font-mono font-bold text-on-primary"
      >
        {savedCount}
      </span>
    );
  }
  if (variant === "mobile-tab") {
    return (
      <span
        aria-label={`${savedCount} spots saved`}
        className="flex h-3.5 min-w-3.5 items-center justify-center rounded-md bg-primary px-0.5 text-[8px] font-bold text-on-primary animate-heart-burst"
      >
        {savedCount}
      </span>
    );
  }
  return (
    <span
      aria-label={`${savedCount} spots saved`}
      className="inline-flex h-4 min-w-4 items-center justify-center rounded-md bg-primary px-1 text-[10px] font-bold text-on-primary"
    >
      {savedCount}
    </span>
  );
}

export function navLabelFor(
  item: (typeof NAV_ITEMS)[number],
  variant: NavVariant,
) {
  if (variant === "mobile-tab") return item.shortLabel;
  if (variant === "mobile-drawer") return item.drawerLabel;
  return item.label;
}
