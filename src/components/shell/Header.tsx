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
      className="sticky top-0 z-40 w-full border-b border-wire-border bg-primary px-5 md:px-10 py-3"
    >
      <div className="flex items-center justify-between gap-4">
        <BrandLogo
          image={resolvedImage}
          alt={imageAlt}
          className="rounded-lg transition-colors hover:bg-wire-border focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
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
            className="flex h-12 w-12 items-center justify-center rounded-lg border-2 border-wire-border bg-wire-border text-on-wire transition-[background-color,border-color,transform] hover:border-wire-border-strong hover:bg-wire-border-strong focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 active:translate-y-px"
          >
            <Search size={16} aria-hidden="true" />
          </button>

          {/* Personal cluster: only for signed-in riders. Anonymous sees Sign in CTA instead of ghost tabs. */}
          {user ? (
            <div className="hidden items-center gap-2 lg:flex">
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
              className="hidden md:inline-flex min-h-12 whitespace-nowrap !rounded-lg !border-2 !border-on-primary !bg-on-primary !px-3 sm:!px-4 !py-0 !text-sm !tracking-[0.04em] !text-primary hover:!bg-on-primary/90 focus-visible:!ring-white focus-visible:!ring-offset-wire active:translate-y-px"
            />
          )}

          <MobileDrawerTrigger />
        </div>
      </div>
    </header>
  );
}
