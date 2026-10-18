"use client";

import { useCallback, useEffect, useState } from "react";
import type { Spot } from "@/lib/types";
import type { SavedSpotWithDetails } from "@/types/saved-spot";

interface SavedListResponse {
  items: SavedSpotWithDetails[];
  nextCursor: string | null;
}

/**
 * Full spot entities for the signed-in user's saved spots, served
 * by `GET /api/saved-spots`. The SSR context only carries
 * (user, spot) head rows so the Saved tab fetches the entities on
 * mount instead of serializing 200 full spots into every route's
 * RSC flight payload. Filtered live against `savedIds` so toggles
 * made during the session are reflected.
 */
export function useSavedSpotList(
  userId: string | null,
  savedIds: ReadonlySet<string>,
) {
  const [links, setLinks] = useState<readonly SavedSpotWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    if (!userId) {
      setLinks([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/saved-spots", { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as
        | SavedListResponse
        | { error?: string }
        | null;
      if (!res.ok) {
        throw new Error(
          (data as { error?: string })?.error ?? "Failed to load saved spots",
        );
      }
      setLinks(
        ((data as SavedListResponse)?.items ?? []) as readonly SavedSpotWithDetails[],
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount is intentional
    void fetchList();
  }, [fetchList]);

  const items: readonly Spot[] = links
    .filter((l) => savedIds.has(l.spotId))
    .map((l) => l.spot);

  return { items, loading, error, refresh: fetchList };
}
