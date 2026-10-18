"use client";

import { useCallback, useEffect, useState } from "react";
import type { Spot } from "@/lib/types";
import type { VerifiedSpotWithDetails } from "@/types/saved-spot";

interface VerifiedListResponse {
  items: VerifiedSpotWithDetails[];
  nextCursor: string | null;
}

/**
 * Full spot entities for the signed-in user's verifications, served
 * by `GET /api/verified-spots/mine`. The SSR context only carries
 * (user, spot) links — ids — so the Saved tab's verified grid fetches
 * the entities on mount instead of cross-referencing the capped
 * client directory (which would hide verified spots outside it).
 * Filtered live against `verifiedIds` so toggles made during the
 * session are reflected.
 */
export function useVerifiedSpotList(
  userId: string | null,
  verifiedIds: ReadonlySet<string>,
) {
  const [links, setLinks] = useState<readonly VerifiedSpotWithDetails[]>([]);
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
      const res = await fetch("/api/verified-spots/mine", { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as
        | VerifiedListResponse
        | { error?: string }
        | null;
      if (!res.ok) {
        throw new Error(
          (data as { error?: string })?.error ?? "Failed to load verified spots",
        );
      }
      setLinks(((data as VerifiedListResponse)?.items ?? []) as readonly VerifiedSpotWithDetails[]);
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
    .filter((l) => verifiedIds.has(l.spotId))
    .map((l) => l.spot);

  return { items, loading, error, refresh: fetchList };
}
