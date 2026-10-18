"use client";

import { useCallback, useEffect, useState } from "react";
import type { Spot } from "@/lib/types";

interface CreatedResponse {
  items: Spot[];
  nextCursor: string | null;
}

export function useCreatedSpots(userId: string | null) {
  const [items, setItems] = useState<readonly Spot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCreated = useCallback(async () => {
    if (!userId) {
      setItems([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/spots?scope=created`, { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as CreatedResponse | { error?: string } | null;
      if (!res.ok) throw new Error((data as { error?: string })?.error ?? "Failed to load created spots");
      setItems(((data as CreatedResponse)?.items ?? []) as Spot[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount is intentional
    void fetchCreated();
  }, [fetchCreated]);

  return { items, loading, error, refresh: fetchCreated };
}
