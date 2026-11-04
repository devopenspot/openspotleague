"use client";

import { useMemo } from "react";
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

export function useNavList(variant: NavVariant) {
  const pathname = usePathname();
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

  return { pathname, navItems };
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
        className="inline-flex h-5 min-w-5 items-center justify-center rounded-control bg-on-wire px-1.5 font-display text-[10px] font-bold leading-none text-wire ring-2 ring-wire"
      >
        {savedCount}
      </span>
    );
  }
  if (variant === "mobile-tab") {
    return (
      <span
        aria-label={`${savedCount} spots saved`}
        className="flex h-4 min-w-4 items-center justify-center rounded-control bg-on-wire px-1 font-display text-[9px] font-bold leading-none text-wire ring-2 ring-wire animate-heart-burst"
      >
        {savedCount}
      </span>
    );
  }
  return (
    <span
      aria-label={`${savedCount} spots saved`}
      className="inline-flex h-4 min-w-4 items-center justify-center rounded-control bg-on-wire px-1 font-display text-[10px] font-bold leading-none text-wire ring-2 ring-wire"
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
