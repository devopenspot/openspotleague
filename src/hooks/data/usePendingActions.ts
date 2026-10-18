"use client";

import { useCallback, useRef, useState } from "react";
import { showToast } from "@/hooks/ui/useToast";

/**
 * Reusable per-key pending tracker.
 * - `pending` is the React state (for rendering)
 * - `ref` is the synchronous set for concurrent checks
 * - `run(key, fn)` guards against duplicate execution for the same key
 */
export function usePendingActions() {
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set());
  const ref = useRef<Set<string>>(new Set());

  const isPending = useCallback(
    (key: string) => pending.has(key),
    [pending],
  );

  const has = isPending;

  const run = useCallback(async (key: string, fn: () => Promise<void>) => {
    if (ref.current.has(key)) {
      showToast("Please wait for this change to finish", "error");
      return;
    }
    ref.current.add(key);
    setPending(new Set(ref.current));
    try {
      await fn();
    } finally {
      ref.current.delete(key);
      setPending(new Set(ref.current));
    }
  }, []);

  const add = useCallback((key: string) => {
    if (ref.current.has(key)) return;
    ref.current.add(key);
    setPending(new Set(ref.current));
  }, []);

  const remove = useCallback((key: string) => {
    if (!ref.current.has(key)) return;
    ref.current.delete(key);
    setPending(new Set(ref.current));
  }, []);

  return { pending, isPending, has, run, add, remove, ref } as const;
}

export type PendingActions = ReturnType<typeof usePendingActions>;
