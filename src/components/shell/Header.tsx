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

export function Header() {
  const router = useRouter();
  const user = useUser();
  const { count: savedCount } = useSavedSpots(user?.id ?? null);
  const tryOpenSearch = useUIStore((s) => s.tryOpenSearch);

  const handleSelect = (path: string) => {
    router.push(path);
  };

  return (
    <header
      id="app-header"
      className="sticky top-0 z-40 w-full border-b border-outline-variant bg-surface-container-lowest px-5 md:px-10 py-3.5 [&_[data-nav-tab]]:rounded-[16px] [&_[data-nav-tab]]:text-xs [&_[data-nav-tab]]:font-semibold [&_[data-nav-tab][aria-selected=true]]:border-b-primary [&_[data-nav-tab][aria-selected=true]]:text-primary"
    >
      <div className="flex items-center justify-between gap-4">
        <BrandLogo className="rounded-[16px] transition-colors hover:bg-surface-container" />

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
            className="flex h-11 w-11 items-center justify-center rounded-full border border-outline-variant bg-surface-container-high text-secondary transition-colors hover:border-outline hover:bg-surface-container-highest hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
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
              className="hidden md:inline-flex !rounded-full !border-primary !bg-primary !px-5 !py-2.5 !text-xs !normal-case !tracking-widest !text-on-primary hover:!bg-primary/90"
            />
          )}

          <MobileDrawerTrigger />
        </div>
      </div>
    </header>
  );
}
