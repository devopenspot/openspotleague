"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUIStore } from "@/stores/ui-store";
import { useSpotsStore } from "@/stores/spots-store";
import { useKeyboardShortcuts } from "@/hooks/ui/useKeyboardShortcuts";
import { MobileDrawer } from "@/components/shell/MobileDrawer";
import { BottomNav } from "@/components/shell/BottomNav";
import { SearchOverlay } from "@/components/shell/SearchOverlay";
import { OnboardingDialog } from "@/components/shell/OnboardingDialog";
import { ToastViewport } from "@/components/shell/Toast";
import { Header } from "@/components/shell/Header";
import { MAIN_CONTENT_ID } from "@/lib/config/constants";
import { ROUTES } from "@/lib/navigation/nav";
import { setMapPreserveLocation } from "@/lib/map/preserve";
import type { MapSpot } from "@/lib/types";
import { MapViewportProvider } from "@/components/map/panels/MapViewportContext";

export function MapShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const tryOpenSearch = useUIStore((s) => s.tryOpenSearch);
  const closeSearch = useUIStore((s) => s.closeSearch);
  const isSearchOpen = useUIStore((s) => s.isSearchOpen);
  const isSearchOpenRef = useRef(isSearchOpen);
  const closeSearchRef = useRef(closeSearch);
  const spots = useSpotsStore((s) => s.spots);
  const pathname = usePathname();

  // Close the search overlay on route change (same behavior as the
  // public shell — search lives across the map chrome too).
  useEffect(() => {
    isSearchOpenRef.current = isSearchOpen;
    closeSearchRef.current = closeSearch;
  }, [closeSearch, isSearchOpen]);

  useEffect(() => {
    if (isSearchOpenRef.current) closeSearchRef.current();
  }, [pathname]);

  // Bind Cmd/Ctrl+K — the public AppShell short-circuits this shortcut
  // on /map, so the map shell owns it.
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
    setMapPreserveLocation();
    router.push(ROUTES.spot(spot.id));
  };

  return (
    <MapViewportProvider>
      <div
        id="app-root"
        className="relative flex h-dvh flex-col bg-surface font-sans text-on-surface selection:bg-primary selection:text-surface"
      >
        <Header />

        <main
          id={MAIN_CONTENT_ID}
          aria-label="Spot map"
          className="relative flex-1 overflow-hidden pb-14 md:pb-0"
        >
          {children}
        </main>

        <BottomNav />
        <MobileDrawer />
        <SearchOverlay
          isOpen={isSearchOpen}
          onClose={closeSearch}
          spots={spots}
          onSelectSpot={handleSelectSpot}
        />
        <OnboardingDialog />
        <ToastViewport />
      </div>
    </MapViewportProvider>
  );
}
