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
          <BrandLogo className="rounded-lg transition-colors hover:bg-wire-border focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2" />
          <button
            id="close-hamburger-btn"
            type="button"
            onClick={closeDrawer}
            aria-label="Close menu"
            className="flex h-12 w-12 items-center justify-center rounded-full border border-wire-border bg-wire-border text-on-wire transition-colors hover:border-wire-border-strong hover:bg-wire-border-strong hover:text-on-wire focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-wire"
          >
            <X size={20} aria-hidden="true" />
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
                          icon={<Icon size={16} aria-hidden="true" />}
                          active={isActive}
                          variant="mobile-drawer"
                          onClick={handleClick}
                          className={
                            isActive
                              ? "!border-b !border-wire-border-strong !border-l-2 !border-l-on-wire !bg-wire-border-strong !text-on-primary focus-visible:outline-2 focus-visible:outline-white focus-visible:-outline-offset-2"
                              : "!border-b !border-wire-border !bg-primary !text-wire-muted hover:!border-wire-border-strong hover:!bg-wire-border hover:!text-on-wire focus-visible:outline-2 focus-visible:outline-white focus-visible:-outline-offset-2"
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

          <p className="p-4 font-display text-xs font-semibold leading-5 text-wire-muted">
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
          className="flex min-h-12 w-full items-center justify-between rounded-lg border-2 border-wire-border bg-wire-border px-4 text-left font-display text-sm font-bold uppercase tracking-[0.04em] text-on-wire transition-[background-color,border-color,transform] hover:border-wire-border-strong hover:bg-wire-border-strong focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 active:translate-y-px"
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
              className="flex items-center gap-3 rounded-lg border-2 border-wire-border bg-wire-border p-3 transition-[background-color,border-color,transform] hover:border-wire-border-strong hover:bg-wire-border-strong focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 active:translate-y-px"
            >
              <UserAvatar user={user} size="md" />
              <div className="min-w-0 flex-1">
                <span className="block font-display text-[10px] font-semibold uppercase tracking-[0.05em] text-wire-muted">
                  Signed in — View profile
                </span>
                <span className="block truncate text-sm font-semibold text-on-wire">
                  {user.email}
                </span>
              </div>
            </Link>
            <SignOutButton
              variant="drawer"
              className="min-h-12 !rounded-lg !border-2 !border-wire-border !bg-wire-border !px-4 !py-0 !text-sm !tracking-[0.04em] !text-on-wire hover:!border-wire-border-strong hover:!bg-wire-border-strong focus-visible:!ring-white focus-visible:!ring-offset-wire active:translate-y-px"
            />
          </>
        ) : (
          <SignInLink
            variant="drawer"
            className="!mt-0 min-h-12 !rounded-lg !border-2 !border-on-primary !bg-on-primary !px-4 !py-0 !text-sm !tracking-[0.04em] !text-primary hover:!bg-on-primary/90 focus-visible:!ring-white focus-visible:!ring-offset-wire active:translate-y-px"
            onClick={closeDrawer}
          />
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
