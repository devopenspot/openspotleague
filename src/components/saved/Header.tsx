"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { Map } from "lucide-react";
import { ROUTES } from "@/lib/navigation/nav";
import { useSavedSpots } from "@/hooks/data/useSavedSpots";
import { useUser } from "@/lib/contexts/user-context";
import { useUIStore } from "@/stores/ui-store";

export default function SavedTab() {
  const router = useRouter();
  const tryRun = useUIStore((s) => s.tryRun);

  const user = useUser();
  const { count: savedCount } = useSavedSpots(user?.id ?? null);

  const handleViewOnMap = useCallback(
    () =>
      tryRun(
        () => router.push(`${ROUTES.map}?saved=1`),
        `${ROUTES.map}?saved=1`,
      ),
    [router, tryRun],
  );
  return (
    <header className="z-40 flex md:w-2/3 rounded-2xl flex-col gap-4 border-b border-outline-variant bg-surface-container-lowest mx-4 md:mx-10 px-5 py-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6 sm:px-6 sm:py-5">
      <div className="min-w-0 flex-1">
        <span className="mb-1 block font-sans text-xs font-semibold tracking-[0.05em] text-secondary uppercase">
          Favorite spots
        </span>
        <h1 className="font-display text-3xl font-bold uppercase leading-[1.3] tracking-[-0.02em] text-on-surface sm:text-4xl">
          Saved Locations
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-on-surface-variant">
          Your bookmarked street spots, parks, and DIY terrain. Active weather
          and crowd logs kept live.
        </p>
      </div>
      {savedCount > 0 && (
        <button
          id="view-saved-on-map-link"
          type="button"
          onClick={handleViewOnMap}
          aria-label="View saved spots on the map"
          className="inline-flex min-h-11 shrink-0 items-center gap-2 self-start rounded-[9999px] border border-primary bg-primary px-6 py-3 font-sans text-xs font-semibold tracking-[0.05em] text-on-primary uppercase transition-opacity hover:opacity-90 focus-visible:outline-offset-4 sm:self-end"
        >
          <Map size={14} aria-hidden="true" />
          <span>View on map</span>
        </button>
      )}
    </header>
  );
}
