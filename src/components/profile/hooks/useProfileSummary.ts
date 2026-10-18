"use client";

import { useEffect, useState } from "react";
import type { ProfileSummary } from "@/lib/services/profile/profile";

export function useProfileSummary() {
  const [summary, setSummary] = useState<ProfileSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    void fetch("/api/profile/summary", { signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error("failed");
        return r.json() as Promise<ProfileSummary>;
      })
      .then(setSummary)
      .catch(() => {
        if (!ctrl.signal.aborted) setError(true);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, []);

  return { summary, loading, error };
}
