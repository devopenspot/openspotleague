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
import { navLabelFor, useNavList } from "@/hooks/ui/useNavList";
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
      panelClassName="w-98 max-w-[calc(100vw-1rem)] justify-between border-l border-wire-border bg-primary text-on-primary"
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-wire-border bg-primary px-5 py-3.5">
          <BrandLogo className="rounded-[16px] transition-colors hover:bg-wire-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-wire" />
          <button
            id="close-hamburger-btn"
            type="button"
            onClick={closeDrawer}
            aria-label="Close menu"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-wire-border bg-wire-border text-on-wire transition-colors hover:border-wire-border-strong hover:bg-wire-border-strong hover:text-on-wire focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-wire"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-primary">
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
                          className={
                            isActive
                              ? "!border-b !border-wire-border-strong !border-l-2 !border-l-on-wire !bg-wire-border-strong !text-on-primary focus-visible:!ring-white focus-visible:!ring-offset-wire"
                              : "!border-b !border-wire-border !bg-primary !text-wire-muted hover:!border-wire-border-strong hover:!bg-wire-border hover:!text-on-wire focus-visible:!ring-white focus-visible:!ring-offset-wire"
                          }
                          badge={
                            showBadge ? (
                              <span
                                aria-label={`${savedCount} spots saved`}
                                className="rounded-md bg-on-wire px-2 py-1 text-[9px] font-mono font-bold text-primary"
                              >
                                {savedCount}
                              </span>
                            ) : undefined
                          }
                        />
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </nav>

          <p className="p-4 font-display text-[10px] leading-relaxed tracking-wide text-wire-muted">
            “I've missed more than 9000 shots in my career. I've lost almost 300
            games. 26 times, I've been trusted to take the game winning shot and
            missed. I've failed over and over and over again in my life. And
            that is why I succeed.” ― Michael Jordan
          </p>
        </div>
      </div>

      <div className="space-y-3 border-t border-wire-border bg-primary px-5 py-5">
        <button
          id="preferences-btn"
          type="button"
          onClick={handleOpenPreferences}
          className="flex min-h-11 w-full items-center justify-between rounded-xl border border-wire-border bg-wire-border px-4 text-left text-xs font-sans font-semibold tracking-[0.05em] uppercase text-on-wire transition-colors hover:border-wire-border-strong hover:bg-wire-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-wire"
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
              className="flex items-center gap-3 rounded-[16px] border border-wire-border bg-wire-border p-3 transition-colors hover:border-wire-border-strong hover:bg-wire-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-wire"
            >
              <UserAvatar user={user} size="md" />
              <div className="min-w-0 flex-1">
                <span className="block text-xs font-sans font-semibold uppercase text-wire-muted">
                  Signed in — View profile
                </span>
                <span className="block truncate text-xs font-semibold text-on-wire">
                  {user.email}
                </span>
              </div>
            </Link>
            <SignOutButton
              variant="drawer"
              className="!rounded-[9999px] !border-wire-border !bg-wire-border !text-on-wire hover:!border-wire-border-strong hover:!bg-wire-border-strong focus-visible:!ring-white focus-visible:!ring-offset-wire"
            />
          </>
        ) : (
          <SignInLink
            variant="drawer"
            className="!mt-0 !rounded-[9999px] !border-on-primary !bg-on-primary !px-6 !py-3 !text-primary font-bold transition-opacity hover:!bg-on-primary hover:!opacity-90 focus-visible:!ring-white focus-visible:!ring-offset-wire"
            onClick={closeDrawer}
          />
        )}
      </div>
    </SideDrawer>
  );
}
