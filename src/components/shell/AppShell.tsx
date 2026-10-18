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
import { useKeyboardShortcuts } from "@/hooks/ui/useKeyboardShortcuts";
import { MAIN_CONTENT_ID } from "@/lib/config/constants";
import { ROUTES } from "@/lib/navigation/nav";
import type { MapSpot } from "@/lib/types";

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const tryOpenSearch = useUIStore((s) => s.tryOpenSearch);
  const closeSearch = useUIStore((s) => s.closeSearch);
  const isSearchOpen = useUIStore((s) => s.isSearchOpen);
  const pathname = usePathname();

  // The admin, map, and games segments render their own shells. Bail out
  // early so public chrome is not double-rendered in those sections.
  const isAdminRoute = pathname?.startsWith("/admin") ?? false;
  const isMapRoute = pathname === "/map";
  const isGameRoute = pathname?.startsWith("/games") ?? false;
  const isLandingRoute = pathname === "/";

  // Close the search overlay on route change
  useEffect(() => {
    if (isSearchOpen) closeSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Only bind the global Cmd/Ctrl+K search shortcut on public routes.
  useKeyboardShortcuts(
    isAdminRoute || isMapRoute || isGameRoute
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

  if (isAdminRoute || isMapRoute || isGameRoute) {
    return <>{children}</>;
  }

  const handleSelectSpot = (spot: MapSpot) => {
    router.push(ROUTES.spot(spot.id));
  };

  return (
    <div
      id="app-root"
      className="flex h-dvh flex-col bg-surface font-sans text-on-surface selection:bg-primary selection:text-surface"
    >
      <Header />

      <main
        id={MAIN_CONTENT_ID}
        aria-label="Open Spot content"
        className={
          isLandingRoute
            ? "min-h-0 w-full flex-1 pb-0"
            : "min-h-0 w-full flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0"
        }
      >
        {children}
      </main>

      {isLandingRoute ? null : <BottomNav />}
      <MobileDrawer />
      {/* Server-backed text search (see SearchOverlay) — no local spot
          directory exists on public pages anymore. */}
      <SearchOverlay
        isOpen={isSearchOpen}
        onClose={closeSearch}
        onSelectSpot={handleSelectSpot}
      />
       <OnboardingDialog />
      <ToastViewport />
    </div>
  );
}
