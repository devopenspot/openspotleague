"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUIStore } from "@/stores/ui-store";
import { useKeyboardShortcuts } from "@/hooks/ui/useKeyboardShortcuts";
import { BottomNav } from "@/components/shell/BottomNav";
import { MobileDrawer } from "@/components/shell/MobileDrawer";
import { SearchOverlay } from "@/components/shell/SearchOverlay";
import { OnboardingDialog } from "@/components/shell/OnboardingDialog";
import { ToastViewport } from "@/components/shell/Toast";
import { MAIN_CONTENT_ID } from "@/lib/config/constants";
import { ROUTES } from "@/lib/navigation/nav";
import type { MapSpot } from "@/lib/types";

export function GameShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const tryOpenSearch = useUIStore((s) => s.tryOpenSearch);
  const closeSearch = useUIStore((s) => s.closeSearch);
  const isSearchOpen = useUIStore((s) => s.isSearchOpen);
  const isSearchOpenRef = useRef(isSearchOpen);
  const closeSearchRef = useRef(closeSearch);
  const pathname = usePathname();

  // Close the search overlay on route change, matching the public shell.
  useEffect(() => {
    isSearchOpenRef.current = isSearchOpen;
    closeSearchRef.current = closeSearch;
  }, [closeSearch, isSearchOpen]);

  useEffect(() => {
    if (isSearchOpenRef.current) closeSearchRef.current();
  }, [pathname]);

  // Bind Cmd/Ctrl+K — the public AppShell short-circuits this shortcut
  // on /games, so the game shell owns it.
  useKeyboardShortcuts([
    {
      key: "k",
      cmdOrCtrl: true,
      handler: (e) => {
        e.preventDefault();
        tryOpenSearch();
      },
    },
  ]);

  const handleSelectSpot = (spot: MapSpot) => {
    router.push(ROUTES.spot(spot.id));
  };

  const isGameLanding = pathname === "/games";

  return (
    <div
      id="app-root"
      className="relative flex h-dvh flex-col bg-surface font-sans text-on-surface selection:bg-primary selection:text-surface"
    >
      <main
        id={MAIN_CONTENT_ID}
        aria-label="Open Spot challenges"
        className={
          isGameLanding
            ? "relative flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto"
            : "relative flex min-h-0 flex-1 flex-col overflow-hidden"
        }
      >
        {children}
      </main>

      {isGameLanding ? <BottomNav /> : null}
      <MobileDrawer />
      {/* Server-backed text search (see SearchOverlay) — no local spot
          directory exists on the games shells anymore. */}
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
