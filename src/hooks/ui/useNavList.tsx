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
        className="flex h-3.5 min-w-3.5 items-center justify-center rounded-md bg-on-wire px-0.5 text-[8px] font-bold text-primary animate-heart-burst"
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
