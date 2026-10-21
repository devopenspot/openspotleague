"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ExploreSpotCard } from "@/components/spots/card/SpotCard";
import { SectionHeader } from "@/components/shell/SectionHeader";
import { SpotMarquee } from "@/components/spots/shared/SpotMarquee";
import { useUserLocation } from "@/hooks/map/useUserLocation";
import { useUser } from "@/lib/contexts/user-context";
import { useSavedSpots } from "@/hooks/data/useSavedSpots";
import { useVerifiedSpots } from "@/hooks/data/useVerifiedSpots";
import { ROUTES } from "@/lib/navigation/nav";
import {
  buildSuggestedSpots,
  SUGGESTED_SPOTS_MIN,
} from "@/lib/spots/suggestions";
import { cn } from "@/lib/utils/cn";
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
  const [selectedType, setSelectedType] = useState<string>("all");

  const result = useMemo(
    () => buildSuggestedSpots({ current: spot, all: pool, origin: location }),
    [spot, pool, location],
  );

  const open = useCallback(
    (s: Spot) => router.push(ROUTES.spot(s.id)),
    [router],
  );

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

  return (
    <section
      id="suggested-spots"
      aria-labelledby="suggested-heading"
      className="mt-8 mx-4 sm:mx-0 rounded-lg border border-outline-variant bg-surface-container-low p-4 sm:p-5 md:mt-16 md:p-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeader
          eyebrow="More to ride"
          title="Suggested Spots"
          titleId="suggested-heading"
          description={result.scopeLabel}
          className="pl-0 pb-0"
        />

        {/* Category filters (active when multiple spot types are available in the suggestions pool) */}
        {typeCategories.length > 1 && (
          <div
            role="tablist"
            aria-label="Filter suggested spots by type"
            className="flex flex-wrap items-center gap-1.5 pb-2 sm:pb-0"
          >
            <button
              type="button"
              role="tab"
              aria-selected={selectedType === "all"}
              onClick={() => setSelectedType("all")}
              className={cn(
                "inline-flex min-h-8 items-center gap-1 rounded-full border px-3 text-[10px] font-bold uppercase tracking-wider transition-colors",
                selectedType === "all"
                  ? "border-primary bg-primary text-on-primary"
                  : "border-outline-variant bg-surface text-on-surface hover:bg-surface-container",
              )}
            >
              <span>All</span>
              <span className="opacity-70">({result.spots.length})</span>
            </button>
            {typeCategories.map((cat) => (
              <button
                key={cat.slug}
                type="button"
                role="tab"
                aria-selected={selectedType === cat.slug}
                onClick={() => setSelectedType(cat.slug)}
                className={cn(
                  "inline-flex min-h-8 items-center gap-1 rounded-full border px-3 text-[10px] font-bold uppercase tracking-wider transition-colors",
                  selectedType === cat.slug
                    ? "border-primary bg-primary text-on-primary"
                    : "border-outline-variant bg-surface text-on-surface hover:bg-surface-container",
                )}
              >
                <span>{cat.name}</span>
                <span className="opacity-70">({cat.count})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4">
        <SpotMarquee
          items={displayedSpots}
          ariaLabel={result.scopeLabel}
          renderItem={(s) => (
            <ExploreSpotCard
              spot={s}
              isSaved={isSaved(s.id)}
              isVerified={isVerified(s.id)}
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
