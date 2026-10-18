"use client";

import { useRouter } from "next/navigation";
import { X, Settings } from "lucide-react";
import Link from "next/link";
import { SideDrawer } from "@/components/feedback/SideDrawer";
import { UserAvatar } from "@/components/ui";
import { SignInLink } from "@/components/shell/SignInLink";
import { SignOutButton } from "@/components/shell/SignOutButton";
import { useUIStore } from "@/stores/ui-store";
import { useSavedSpots } from "@/hooks/data/useSavedSpots";
import { useUser } from "@/lib/contexts/user-context";
import { BrandLogo } from "@/components/shell/BrandLogo";
import { isActivePath, type NavGroup } from "@/lib/navigation/nav";
import { navLabelFor, renderNavBadge, useNavList } from "@/hooks/ui/useNavList";
import { NavLink } from "@/components/shell/NavLink";

const DRAWER_ID = "mobile-hamburger-portal";
const DRAWER_TITLE_ID = "mobile-drawer-title";

const DRAWER_GROUP_ORDER: readonly NavGroup[] = [
  "discover",
  "play",
  "you",
  "meta",
  "curator",
] as const;

export function MobileDrawer() {
  const router = useRouter();
  const isDrawerOpen = useUIStore((s) => s.isDrawerOpen);
  const closeDrawer = useUIStore((s) => s.closeDrawer);
  const openPreferences = useUIStore((s) => s.openPreferences);
  const user = useUser();
  const { count: savedCount } = useSavedSpots(user?.id ?? null);
  const tryRun = useUIStore((s) => s.tryRun);

  const handleSelect = (path: string) => {
    router.push(path);
    closeDrawer();
  };

  const handleOpenPreferences = () => {
    closeDrawer();
    openPreferences();
  };

  const {
    pathname,
    navItems,
    handleSelect: navHandleSelect,
  } = useNavList({
    variant: "mobile-drawer",
    onSelect: handleSelect,
  });

  return (
    <SideDrawer
      isOpen={isDrawerOpen}
      onClose={closeDrawer}
      labelledBy={DRAWER_TITLE_ID}
      contentId={DRAWER_ID}
      closeOnRouteChange={false}
      side="right"
      panelClassName="w-90 max-w-[calc(100vw-1rem)] justify-between border-r border-outline-variant bg-surface-container-lowest text-on-surface"
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-outline-variant bg-surface-container-lowest px-5 py-3.5">
          <BrandLogo className="rounded-[16px] transition-colors hover:bg-surface-container" />
          <button
            id="close-hamburger-btn"
            type="button"
            onClick={closeDrawer}
            aria-label="Close menu"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-on-surface text-on-surface transition-colors hover:bg-surface-container hover:text-on-surface"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto [&_[data-nav-tab]]:border-on-surface [&_[data-nav-tab]]:bg-surface-container-lowest [&_[data-nav-tab]]:text-on-surface [&_[data-nav-tab][aria-current=page]]:border-primary [&_[data-nav-tab][aria-current=page]]:bg-primary [&_[data-nav-tab][aria-current=page]]:text-on-primary">
          <h3 id={DRAWER_TITLE_ID} className="visually-hidden">
            Primary navigation
          </h3>

          <nav aria-labelledby={DRAWER_TITLE_ID} className="space-y-0">
            {DRAWER_GROUP_ORDER.map((group) => {
              const items = navItems.filter((item) => item.group === group);
              if (items.length === 0) return null;
              return (
                <section key={group} aria-labelledby={`drawer-group-${group}`}>
                  <div className="flex flex-col">
                    {items.map((item) => {
                      const isActive = isActivePath(pathname, item.path);
                      const showBadge = item.id === "saved" && savedCount > 0;
                      const Icon = item.Icon;
                      const requiresOnboarding = item.id === "saved";
                      const handleClick = requiresOnboarding
                        ? () => tryRun(() => handleSelect(item.path), item.path)
                        : navHandleSelect(item.path);
                      return (
                        <NavLink
                          key={item.id}
                          tab={item.id}
                          label={navLabelFor(item, "mobile-drawer")}
                          icon={<Icon size={16} aria-hidden="true" />}
                          active={isActive}
                          variant="mobile-drawer"
                          onClick={handleClick}
                          badge={
                            showBadge
                              ? renderNavBadge({
                                  variant: "mobile-drawer",
                                  id: item.id,
                                  savedCount,
                                })
                              : undefined
                          }
                        />
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </nav>

          <p className="p-4 font-display text-[10px] leading-relaxed tracking-wide text-on-surface">
            “I've missed more than 9000 shots in my career. I've lost almost 300
            games. 26 times, I've been trusted to take the game winning shot and
            missed. I've failed over and over and over again in my life. And
            that is why I succeed.” ― Michael Jordan
          </p>
        </div>
      </div>

      <div className="space-y-3 border-t border-outline-variant bg-surface-container-low px-5 py-5">
        <button
          id="preferences-btn"
          type="button"
          onClick={handleOpenPreferences}
          className="flex min-h-11 w-full items-center justify-between rounded-xl border border-outline-variant bg-surface-container-high px-4 text-left text-xs font-sans font-semibold tracking-[0.05em] uppercase text-on-surface transition-colors hover:border-outline hover:bg-surface-container-highest"
        >
          <span className="flex items-center gap-2">
            <Settings size={14} aria-hidden="true" />
            Preferences
          </span>
        </button>
        {user ? (
          <>
            <Link
              href="/profile"
              onClick={closeDrawer}
              className="flex items-center gap-3 rounded-[16px] border border-outline-variant bg-surface-container-lowest p-3 transition-colors hover:border-outline hover:bg-surface-container"
            >
              <UserAvatar user={user} size="md" />
              <div className="min-w-0 flex-1">
                <span className="block text-xs font-sans font-semibold uppercase text-secondary">
                  Signed in — View profile
                </span>
                <span className="block truncate text-xs font-semibold text-on-surface">
                  {user.email}
                </span>
              </div>
            </Link>
            <SignOutButton
              variant="drawer"
              className="!rounded-[9999px] !border-outline-variant !bg-surface-container-high !text-on-surface hover:!border-outline hover:!bg-surface-container-highest"
            />
          </>
        ) : (
          <SignInLink
            variant="drawer"
            className="!mt-0 !rounded-[9999px] !border-primary !bg-primary !px-6 !py-3 !text-on-primary transition-opacity hover:!bg-primary hover:!opacity-90"
            onClick={closeDrawer}
          />
        )}
      </div>
    </SideDrawer>
  );
}
