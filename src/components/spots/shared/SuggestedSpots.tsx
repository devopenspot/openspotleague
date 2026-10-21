"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ExploreSpotCard } from "@/components/spots/card/SpotCard";
import { SectionHeader } from "@/components/shell/SectionHeader";
import { useUserLocation } from "@/hooks/map/useUserLocation";
import { useUser } from "@/lib/contexts/user-context";
import { useSavedSpots } from "@/hooks/data/useSavedSpots";
import { useVerifiedSpots } from "@/hooks/data/useVerifiedSpots";
import { ROUTES } from "@/lib/navigation/nav";
import {
  buildSuggestedSpots,
  SUGGESTED_SPOTS_MIN,
} from "@/lib/spots/suggestions";
import type { Spot } from "@/lib/types";

interface SuggestedSpotsProps {
  spot: Spot;
  /**
   * Server-fetched pool of spots near `spot` (PostGIS nearby query on
   * the detail page). Replaces the capped client-directory pool —
   * `buildSuggestedSpots` still re-ranks it by the user's live
   * location when granted.
   */
  pool: readonly Spot[];
}

export function SuggestedSpots({ spot, pool }: SuggestedSpotsProps) {
  const user = useUser();
  const { location } = useUserLocation();
  const { isSaved, toggle } = useSavedSpots(user?.id ?? null);
  const { isVerified, toggle: toggleVerified } = useVerifiedSpots(
    user?.id ?? null,
  );
  const router = useRouter();

  const result = useMemo(
    () => buildSuggestedSpots({ current: spot, all: pool, origin: location }),
    [spot, pool, location],
  );

  const open = useCallback(
    (s: Spot) => router.push(ROUTES.spot(s.id)),
    [router],
  );

  if (result.spots.length < SUGGESTED_SPOTS_MIN) return null;

  return (
    <section
      id="suggested-spots"
      aria-labelledby="suggested-heading"
      className="mt-8 mx-4 sm:mx-0 rounded-lg border border-outline-variant bg-surface-container-low p-4 sm:p-5 md:mt-16 md:p-6"
    >
      <SectionHeader
        eyebrow="More to ride"
        title="Suggested Spots"
        titleId="suggested-heading"
        description={result.scopeLabel}
        className="pl-0"
      />
      <div
        role="region"
        aria-label={result.scopeLabel}
        className="flex snap-x gap-3 overflow-x-auto pb-2 no-scrollbar scroll-smooth sm:gap-4"
      >
        {result.spots.map((s) => (
          <div
            key={s.id}
            className="w-[82vw] max-w-[280px] shrink-0 snap-start sm:w-auto sm:min-w-[300px] lg:min-w-[320px]"
          >
            <ExploreSpotCard
              spot={s}
              isSaved={isSaved(s.id)}
              isVerified={isVerified(s.id)}
              onOpen={open}
              onToggleSave={toggle}
              onToggleVerify={toggleVerified}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
