"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Header } from "./Header";
import { MobileDrawer } from "@/components/shell/MobileDrawer";
import { BottomNav } from "@/components/shell/BottomNav";
import { SearchOverlay } from "@/components/shell/SearchOverlay";
import { OnboardingDialog } from "@/components/shell/OnboardingDialog";
import { ToastViewport } from "@/components/shell/Toast";
import { useUIStore } from "@/stores/ui-store";
import { useSpotsStore } from "@/stores/spots-store";
import { useKeyboardShortcuts } from "@/hooks/ui/useKeyboardShortcuts";
import { MAIN_CONTENT_ID } from "@/lib/config/constants";
import { ROUTES } from "@/lib/navigation/nav";
import { setMapPreserveLocation } from "@/lib/map/preserve";
import type { MapSpot } from "@/lib/types";

export interface AppShellProps {
  children: React.ReactNode;
  headerImage?: string;
  headerImageAlt?: string;
}

export function AppShell({
  children,
  headerImage,
  headerImageAlt,
}: AppShellProps) {
  const router = useRouter();
  const tryOpenSearch = useUIStore((s) => s.tryOpenSearch);
  const closeSearch = useUIStore((s) => s.closeSearch);
  const isSearchOpen = useUIStore((s) => s.isSearchOpen);
  const spots = useSpotsStore((s) => s.spots);
  const pathname = usePathname();

  // Admin section maintains its own dedicated AdminShell and auth gate.
  const isAdminRoute = pathname?.startsWith("/admin") ?? false;
  const isMapRoute = pathname === "/map";
  const isGameRoute = pathname?.startsWith("/games") ?? false;
  const isGameLanding = pathname === "/games";
  const isGameSession =
    isGameRoute && !isGameLanding && !pathname?.startsWith("/games/join");
  const isLandingRoute = pathname === "/";

  // Close the search overlay on route change
  useEffect(() => {
    if (isSearchOpen) closeSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Global Cmd/Ctrl+K search shortcut across all public routes.
  useKeyboardShortcuts(
    isAdminRoute
      ? []
      : [
          {
            key: "k",
            cmdOrCtrl: true,
            handler: (e) => {
              e.preventDefault();
              tryOpenSearch();
            },
          },
        ],
  );

  if (isAdminRoute) {
    return <>{children}</>;
  }

  const handleSelectSpot = (spot: MapSpot) => {
    if (isMapRoute) setMapPreserveLocation();
    router.push(ROUTES.spot(spot.id));
  };

  let mainClassName =
    "min-h-0 w-full flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0";
  let mainAriaLabel = "Open Spot content";

  if (isMapRoute) {
    mainClassName = "relative min-h-0 flex-1 overflow-hidden pb-14 md:pb-0";
    mainAriaLabel = "Spot map";
  } else if (isGameSession) {
    mainClassName =
      "relative flex min-h-0 flex-1 flex-col overflow-hidden pb-0";
    mainAriaLabel = "Open Spot challenges";
  } else if (isGameLanding) {
    mainClassName =
      "relative flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0";
    mainAriaLabel = "Open Spot challenges";
  } else if (isLandingRoute) {
    mainClassName =
      "relative flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-contain pb-0";
  }

  const showHeader = !isGameSession;
  const showBottomNav = !isLandingRoute && !isGameSession;

  return (
    <div
      id="app-root"
      className="relative flex h-dvh flex-col bg-surface font-sans text-on-surface selection:bg-primary selection:text-surface"
    >
      {showHeader ? (
        <Header image={headerImage} imageAlt={headerImageAlt} />
      ) : null}

      <main id={MAIN_CONTENT_ID} aria-label={mainAriaLabel} className={mainClassName}>
        {children}
      </main>

      {showBottomNav ? <BottomNav /> : null}
      <MobileDrawer />
      <SearchOverlay
        isOpen={isSearchOpen}
        onClose={closeSearch}
        spots={isMapRoute ? spots : undefined}
        onSelectSpot={handleSelectSpot}
      />
      <OnboardingDialog />
      <ToastViewport placement={isGameSession ? "top" : "bottom"} />
    </div>
  );
}
