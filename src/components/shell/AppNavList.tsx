"use client";

import { isActivePath, type NavGroup } from "@/lib/navigation/nav";
import { NavLink, type NavVariant } from "@/components/shell/NavLink";
import { navLabelFor, renderNavBadge, useNavList } from "@/hooks/ui/useNavList";
import { useUIStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils/cn";

interface AppNavListProps {
  variant: NavVariant;
  savedCount: number;
  /** Runs for links that gate navigation behind onboarding (Saved). */
  onSelect: (path: string) => void;
  /** Optional filter to only render certain groups (e.g. header primary vs you) */
  groups?: readonly NavGroup[];
  /** Override container id for grouped renders (avoids duplicate ids) */
  containerId?: string;
  /** Override the landmark name when a variant renders more than one list */
  label?: string;
}

const VARIANT_CONTAINER: Record<NavVariant, string> = {
  desktop: "hidden items-center gap-2 md:flex",
  "mobile-tab":
    "fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-wire-border bg-primary px-2 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] md:hidden",
  "mobile-drawer": "flex flex-col gap-2",
};

export function AppNavList({
  variant,
  savedCount,
  onSelect,
  groups,
  containerId: containerIdProp,
  label,
}: AppNavListProps) {
  const { pathname, navItems: baseItems } = useNavList(variant);
  const navItems = groups
    ? baseItems.filter((item) => groups.includes(item.group))
    : baseItems;
  const tryRun = useUIStore((s) => s.tryRun);

  const containerLabel =
    label ??
    (variant === "mobile-drawer"
      ? "Drawer primary navigation"
      : "Primary navigation");
  const containerId =
    containerIdProp ??
    (variant === "desktop"
      ? "desktop-nav"
      : variant === "mobile-tab"
        ? "mobile-nav"
        : undefined);
  return (
    <nav
      id={containerId}
      aria-label={containerLabel}
      className={cn(VARIANT_CONTAINER[variant])}
    >
      {navItems.map((item) => {
        const isActive = isActivePath(pathname, item.path);
        const showBadge = item.id === "saved" && savedCount > 0;
        const Icon = item.Icon;
        const requiresOnboarding = item.id === "saved";
        return (
          <NavLink
            key={item.id}
            tab={item.id}
            href={item.path}
            label={navLabelFor(item, variant)}
            icon={<Icon size={18} aria-hidden="true" />}
            active={isActive}
            variant={variant}
            onClick={
              requiresOnboarding
                ? (event) => {
                    event.preventDefault();
                    tryRun(() => onSelect(item.path), item.path);
                  }
                : undefined
            }
            badge={
              showBadge
                ? renderNavBadge({ variant, id: item.id, savedCount })
                : undefined
            }
          />
        );
      })}
    </nav>
  );
}
