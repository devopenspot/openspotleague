"use client";

import type { MouseEventHandler } from "react";
import { useRouter } from "next/navigation";
import { X, Settings } from "lucide-react";
import Link from "next/link";
import { SIDE_DRAWER_PANEL } from "@/components/feedback/DrawerParts";
import { SideDrawer } from "@/components/feedback/SideDrawer";
import { UserAvatar } from "@/components/ui";
import { SignInLink } from "@/components/shell/SignInLink";
import { SignOutButton } from "@/components/shell/SignOutButton";
import { useUIStore } from "@/stores/ui-store";
import { useSavedSpots } from "@/hooks/data/useSavedSpots";
import { useUser } from "@/lib/contexts/user-context";
import { BrandLogo } from "@/components/shell/BrandLogo";
import { isActivePath, type NavGroup } from "@/lib/navigation/nav";
import { NavLink } from "@/components/shell/NavLink";
import { navLabelFor, renderNavBadge, useNavList } from "@/hooks/ui/useNavList";
import { controlClass, iconButtonClass, LABEL } from "@/components/ui/recipes";
import { cn } from "@/lib/utils/cn";

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

  const { pathname, navItems } = useNavList("mobile-drawer");

  return (
    <SideDrawer
      isOpen={isDrawerOpen}
      onClose={closeDrawer}
      labelledBy={DRAWER_TITLE_ID}
      contentId={DRAWER_ID}
      closeOnRouteChange={false}
      side="right"
      panelClassName={`${SIDE_DRAWER_PANEL} justify-between bg-primary text-on-primary`}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-wire-border bg-primary px-5 py-3">
          <BrandLogo className="transition-colors hover:bg-wire-border focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2" />
          <button
            id="close-hamburger-btn"
            type="button"
            onClick={closeDrawer}
            aria-label="Close menu"
            className={iconButtonClass("onWireOutline")}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-primary">
          <h3 id={DRAWER_TITLE_ID} className="visually-hidden">
            Primary navigation
          </h3>

          <nav aria-labelledby={DRAWER_TITLE_ID} className="space-y-2 px-5 pt-4">
            {DRAWER_GROUP_ORDER.map((group) => {
              const items = navItems.filter((item) => item.group === group);
              if (items.length === 0) return null;
              return (
                <section key={group} aria-labelledby={`drawer-group-${group}`}>
                  <div className="flex flex-col gap-2">
                    {items.map((item) => {
                      const isActive = isActivePath(pathname, item.path);
                      const showBadge = item.id === "saved" && savedCount > 0;
                      const Icon = item.Icon;
                      const requiresOnboarding = item.id === "saved";
                      const handleClick: MouseEventHandler<HTMLAnchorElement> =
                        requiresOnboarding
                          ? (event) => {
                              event.preventDefault();
                              tryRun(() => handleSelect(item.path), item.path);
                            }
                          : closeDrawer;
                      return (
                        <NavLink
                          key={item.id}
                          tab={item.id}
                          href={item.path}
                          label={navLabelFor(item, "mobile-drawer")}
                          icon={<Icon size={18} aria-hidden="true" />}
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

          <p className="px-5 py-6 text-xs leading-5 text-wire-muted">
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
          className={cn(controlClass("onWireOutline"), "w-full justify-start")}
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
              className="flex items-center gap-3 rounded-container border border-wire-border bg-wire-border p-3 transition-[background-color,border-color] hover:border-wire-border-strong hover:bg-wire-border-strong focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
            >
              <UserAvatar user={user} size="md" />
              <div className="min-w-0 flex-1">
                <span className={cn(LABEL, "block text-wire-muted")}>
                  Signed in — View profile
                </span>
                <span className="block truncate text-sm font-semibold text-on-wire">
                  {user.email}
                </span>
              </div>
            </Link>
            <SignOutButton variant="wire" />
          </>
        ) : (
          <SignInLink variant="app-drawer" onClick={closeDrawer} />
        )}
        <div className="flex items-center justify-center gap-3 pt-2 text-xs font-semibold text-wire-muted">
          <Link
            href="/terms"
            onClick={closeDrawer}
            className="hover:text-on-wire underline decoration-wire-border"
          >
            Terms of Use
          </Link>
          <span aria-hidden="true">•</span>
          <Link
            href="/privacy"
            onClick={closeDrawer}
            className="hover:text-on-wire underline decoration-wire-border"
          >
            Privacy Policy
          </Link>
        </div>
      </div>
    </SideDrawer>
  );
}
