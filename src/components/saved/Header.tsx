"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { Map } from "lucide-react";
import { ROUTES } from "@/lib/navigation/nav";
import { useSavedSpots } from "@/hooks/data/useSavedSpots";
import { useUser } from "@/lib/contexts/user-context";
import { useUIStore } from "@/stores/ui-store";
import {
  BODY,
  EYEBROW,
  PAGE_TITLE,
  controlClass,
} from "@/components/ui/recipes";

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
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
      <div className="min-w-0 flex-1">
        <p className={EYEBROW}>Favorite spots</p>
        <h1 className={`mt-1 ${PAGE_TITLE} text-on-surface`}>
          Saved Locations
        </h1>
        <p className={`mt-2 max-w-xl ${BODY}`}>
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
          className={`self-start sm:self-end ${controlClass("primary")}`}
        >
          <Map size={14} aria-hidden="true" />
          <span>View on map</span>
        </button>
      )}
    </header>
  );
}
