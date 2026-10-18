"use client";

import { isActivePath, type NavGroup } from "@/lib/navigation/nav";
import { NavLink, type NavVariant } from "@/components/shell/NavLink";
import { navLabelFor, renderNavBadge, useNavList } from "@/hooks/ui/useNavList";
import { useUIStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils/cn";

interface AppNavListProps {
  variant: NavVariant;
  savedCount: number;
  controlsId?: string;
  onSelect: (path: string) => void;
  /** Optional filter to only render certain groups (e.g. header primary vs you) */
  groups?: readonly NavGroup[];
  /** Override container id for grouped renders (avoids duplicate ids) */
  containerId?: string;
}

const VARIANT_CONTAINER: Record<NavVariant, string> = {
  desktop: "hidden items-center gap-2 md:flex",
  "mobile-tab":
    "fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-outline-variant bg-surface px-2 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] md:hidden",
  "mobile-drawer": "flex flex-col gap-2",
};

export function AppNavList({
  variant,
  savedCount,
  controlsId,
  onSelect,
  groups,
  containerId: containerIdProp,
}: AppNavListProps) {
  const {
    pathname,
    listRef,
    handleSelect,
    handleKeyDown,
    navItems: baseItems,
  } = useNavList({
    variant,
    onSelect,
  });
  const navItems = groups
    ? baseItems.filter((item) => groups.includes(item.group))
    : baseItems;
  const tryRun = useUIStore((s) => s.tryRun);

  const containerRole = variant === "mobile-drawer" ? "navigation" : "tablist";
  const containerLabel =
    variant === "mobile-drawer"
      ? "Drawer primary navigation"
      : "Primary navigation";
  const containerId =
    containerIdProp ??
    (variant === "desktop"
      ? "desktop-nav"
      : variant === "mobile-tab"
        ? "mobile-nav"
        : undefined);
  return (
    <div
      ref={listRef}
      id={containerId}
      role={containerRole}
      aria-label={containerLabel}
      onKeyDown={variant === "mobile-drawer" ? undefined : handleKeyDown}
      className={cn(VARIANT_CONTAINER[variant])}
    >
      {navItems.map((item) => {
        const isActive = isActivePath(pathname, item.path);
        const showBadge = item.id === "saved" && savedCount > 0;
        const Icon = item.Icon;
        const requiresOnboarding = item.id === "saved";
        const handleClick = requiresOnboarding
          ? () => tryRun(() => onSelect(item.path), item.path)
          : handleSelect(item.path);
        return (
          <NavLink
            key={item.id}
            tab={item.id}
            label={navLabelFor(item, variant)}
            icon={<Icon size={18} aria-hidden="true" />}
            active={isActive}
            variant={variant}
            controlsId={controlsId}
            onClick={handleClick}
            badge={
              showBadge
                ? renderNavBadge({ variant, id: item.id, savedCount })
                : undefined
            }
          />
        );
      })}
    </div>
  );
}
