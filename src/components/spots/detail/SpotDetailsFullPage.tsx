"use client";

import { SpotDetailsContent } from "./SpotDetailsContent";
import { SuggestedSpots } from "@/components/spots/shared/SuggestedSpots";
import { useSavedSpots } from "@/hooks/data/useSavedSpots";
import { useVerifiedSpots } from "@/hooks/data/useVerifiedSpots";
import { useUser } from "@/lib/contexts/user-context";
import type { Spot } from "@/lib/types";

export function SpotDetailsFullPage({
  spot,
  suggestedPool = [],
}: {
  spot: Spot;
  suggestedPool?: readonly Spot[];
}) {
  const user = useUser();
  const { isSaved, toggle: toggleSaved } = useSavedSpots(user?.id ?? null);
  const { isVerified, toggle: toggleVerified } = useVerifiedSpots(user?.id ?? null);

  return (
    <div className="mx-auto max-w-6xl pb-12 animate-fade-in sm:px-6 md:px-8 md:py-8 md:pb-16">
      <article>
        <SpotDetailsContent
          spot={spot}
          isSaved={isSaved(spot.id)}
          isVerified={isVerified(spot.id)}
          onToggleSave={toggleSaved}
          onToggleVerify={toggleVerified}
        />
      </article>
      <SuggestedSpots spot={spot} pool={suggestedPool} />
    </div>
  );
}
