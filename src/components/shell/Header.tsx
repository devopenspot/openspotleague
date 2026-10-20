"use client";

import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { AppNavList } from "@/components/shell/AppNavList";
import { MobileDrawerTrigger } from "@/components/shell/MobileDrawerTrigger";
import { NotificationBell } from "@/components/shell/NotificationBell";
import { SignInLink } from "@/components/shell/SignInLink";
import { useSavedSpots } from "@/hooks/data/useSavedSpots";
import { useUser } from "@/lib/contexts/user-context";
import { useUIStore } from "@/stores/ui-store";
import { MAIN_CONTENT_ID } from "@/lib/config/constants";
import { BrandLogo } from "@/components/shell/BrandLogo";

export interface HeaderProps {
  image?: string;
  imageAlt?: string;
}

export function Header({ image, imageAlt }: HeaderProps = {}) {
  const router = useRouter();
  const user = useUser();
  const { count: savedCount } = useSavedSpots(user?.id ?? null);
  const tryOpenSearch = useUIStore((s) => s.tryOpenSearch);
  const storeHeaderImage = useUIStore((s) => s.headerImage);

  const resolvedImage = image ?? storeHeaderImage ?? undefined;

  const handleSelect = (path: string) => {
    router.push(path);
  };

  return (
    <header
      id="app-header"
      className="sticky top-0 z-40 w-full border-b border-wire-border bg-primary px-5 md:px-10 py-3.5 [&_[data-nav-tab]]:rounded-[16px] [&_[data-nav-tab]]:text-xs [&_[data-nav-tab]]:font-semibold [&_[data-nav-tab]]:text-wire-muted hover:[&_[data-nav-tab]]:text-on-wire hover:[&_[data-nav-tab]]:bg-wire-border focus-visible:[&_[data-nav-tab]]:ring-white focus-visible:[&_[data-nav-tab]]:ring-offset-wire [&_[data-nav-tab][aria-selected=true]]:border-b-2 [&_[data-nav-tab][aria-selected=true]]:border-b-on-wire [&_[data-nav-tab][aria-selected=true]]:text-on-wire [&_[data-nav-tab][aria-selected=true]]:bg-wire-border/50 [&_a[href='/notifications']]:border-wire-border [&_a[href='/notifications']]:bg-wire-border [&_a[href='/notifications']]:text-on-wire hover:[&_a[href='/notifications']]:border-wire-border-strong hover:[&_a[href='/notifications']]:bg-wire-border-strong hover:[&_a[href='/notifications']]:text-on-wire focus-visible:[&_a[href='/notifications']]:ring-white focus-visible:[&_a[href='/notifications']]:ring-offset-wire [&_[data-notification-badge]]:bg-on-wire [&_[data-notification-badge]]:text-primary [&_#mobile-hamburger-btn]:border-wire-border [&_#mobile-hamburger-btn]:bg-wire-border [&_#mobile-hamburger-btn]:text-on-wire hover:[&_#mobile-hamburger-btn]:border-wire-border-strong hover:[&_#mobile-hamburger-btn]:bg-wire-border-strong hover:[&_#mobile-hamburger-btn]:text-on-wire focus-visible:[&_#mobile-hamburger-btn]:ring-white focus-visible:[&_#mobile-hamburger-btn]:ring-offset-wire"
    >
      <div className="flex items-center justify-between gap-4">
        <BrandLogo
          image={resolvedImage}
          alt={imageAlt}
          className="rounded-[16px] transition-colors hover:bg-wire-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-wire"
        />

        {/* Primary discovery + play — 4 items max (Explore, Map, Events, League).
            Hidden on mobile (<md) where BottomNav takes over. */}
        <AppNavList
          variant="desktop"
          groups={["discover", "play"]}
          savedCount={savedCount}
          controlsId={MAIN_CONTENT_ID}
          onSelect={handleSelect}
        />

        <div id="header-actions" className="flex items-center gap-2 sm:gap-3">
          {user && <NotificationBell />}

          <button
            type="button"
            aria-label="Search spots"
            onClick={tryOpenSearch}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-wire-border bg-wire-border text-on-wire transition-colors hover:border-wire-border-strong hover:bg-wire-border-strong hover:text-on-wire focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-wire"
          >
            <Search size={16} aria-hidden="true" />
          </button>

          {/* Personal cluster: only for signed-in riders. Anonymous sees Sign in CTA instead of ghost tabs. */}
          {user ? (
            <div className="hidden items-center gap-2 md:flex">
              <AppNavList
                variant="desktop"
                groups={["you"]}
                savedCount={savedCount}
                controlsId={MAIN_CONTENT_ID}
                onSelect={handleSelect}
                containerId="desktop-nav-you"
              />
            </div>
          ) : (
            <SignInLink
              variant="header"
              className="hidden md:inline-flex !rounded-full !border-on-primary !bg-on-primary !px-5 !py-2.5 !text-xs !normal-case !tracking-widest !text-primary font-bold hover:!bg-on-primary/90 focus-visible:!ring-white focus-visible:!ring-offset-wire"
            />
          )}

          <MobileDrawerTrigger />
        </div>
      </div>
    </header>
  );
}
