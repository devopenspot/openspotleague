"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Navigation } from "lucide-react";
import { ExploreSpotCard } from "@/components/spots/card/SpotCard";
import { SectionHeader } from "@/components/shell/SectionHeader";
import { SpotMarquee } from "@/components/spots/shared/SpotMarquee";
import { useUserLocation } from "@/hooks/map/useUserLocation";
import { useUser } from "@/lib/contexts/user-context";
import { useSavedSpots } from "@/hooks/data/useSavedSpots";
import { useVerifiedSpots } from "@/hooks/data/useVerifiedSpots";
import { usePreferencesStore } from "@/stores/preferences-store";
import { ROUTES } from "@/lib/navigation/nav";
import { getSpotDistanceInfo } from "@/lib/spots/geo";
import {
  buildSuggestedSpots,
  SUGGESTED_SPOTS_MIN,
} from "@/lib/spots/suggestions";
import { chipClass, tagClass } from "@/components/ui/recipes";
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

const EDGE_FADE = {
  left: "from-surface to-transparent",
  right: "from-surface to-transparent",
};

export function SuggestedSpots({ spot, pool }: SuggestedSpotsProps) {
  const user = useUser();
  const { location } = useUserLocation();
  const distanceUnit = usePreferencesStore((s) => s.distanceUnit);
  const { isSaved, toggle } = useSavedSpots(user?.id ?? null);
  const { isVerified, toggle: toggleVerified } = useVerifiedSpots(
    user?.id ?? null,
  );
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<string>("all");

  const result = useMemo(
    () => buildSuggestedSpots({ current: spot, all: pool, origin: location }),
    [spot, pool, location],
  );

  const open = useCallback(
    (s: Spot) => router.push(ROUTES.spot(s.id)),
    [router],
  );

  // Same origin `buildSuggestedSpots` ranks by: the rider, else this spot.
  const distanceLabels = useMemo(() => {
    const origin = location ?? spot.location;
    const labels = new Map<string, string>();
    for (const s of result.spots) {
      const info = getSpotDistanceInfo(s, origin, distanceUnit);
      if (info.kind === "distance") labels.set(s.id, info.label);
    }
    return labels;
  }, [result.spots, location, spot.location, distanceUnit]);

  // Derive distinct spot types from the pool for category filter pills
  const typeCategories = useMemo(() => {
    const counts = new Map<string, { slug: string; name: string; count: number }>();
    for (const s of result.spots) {
      for (const t of s.types) {
        const existing = counts.get(t.slug);
        if (existing) {
          existing.count += 1;
        } else {
          counts.set(t.slug, { slug: t.slug, name: t.name, count: 1 });
        }
      }
    }
    return Array.from(counts.values());
  }, [result.spots]);

  const displayedSpots = useMemo(() => {
    if (selectedType === "all") return result.spots;
    return result.spots.filter((s) =>
      s.types.some((t) => t.slug === selectedType),
    );
  }, [result.spots, selectedType]);

  if (result.spots.length < SUGGESTED_SPOTS_MIN) return null;

  const filters = [
    { slug: "all", name: "All", count: result.spots.length },
    ...typeCategories,
  ];

  return (
    <section
      id="suggested-spots"
      aria-labelledby="suggested-heading"
      className="mt-10 border-t border-outline-variant px-5 pt-8 md:mt-16 md:px-0 md:pt-12"
    >
      <SectionHeader
        eyebrow="More to ride"
        eyebrowIcon={
          <Navigation size={12} className="text-secondary" aria-hidden="true" />
        }
        title="Suggested Spots"
        titleId="suggested-heading"
        description={result.scopeLabel}
        cta={
          <span className={tagClass("outline")}>
            {result.spots.length} spots
          </span>
        }
      />

      {/* Category filters (only when the suggestions span several spot types) */}
      {typeCategories.length > 1 && (
        <div
          role="tablist"
          aria-label="Filter suggested spots by type"
          className="-mx-5 mt-5 flex gap-2 overflow-x-auto no-scrollbar px-5 py-0.5 md:mx-0 md:px-0"
        >
          {filters.map((cat) => {
            const active = selectedType === cat.slug;
            return (
              <button
                key={cat.slug}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedType(cat.slug)}
                className={chipClass(active)}
              >
                <span>{cat.name}</span>
                <span
                  className={`tabular-nums ${active ? "opacity-80" : "opacity-60"}`}
                >
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div key={selectedType} className="-mx-5 mt-5 animate-fade-in md:mx-0">
        <SpotMarquee
          items={displayedSpots}
          ariaLabel={result.scopeLabel}
          edgeFadeClass={EDGE_FADE}
          scrollerClassName="px-5 scroll-px-5 md:px-0 md:scroll-px-0"
          renderItem={(s) => (
            <ExploreSpotCard
              spot={s}
              isSaved={isSaved(s.id)}
              isVerified={isVerified(s.id)}
              distanceLabel={distanceLabels.get(s.id)}
              onOpen={open}
              onToggleSave={toggle}
              onToggleVerify={toggleVerified}
            />
          )}
        />
      </div>
    </section>
  );
}
