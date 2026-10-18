"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface ProgressiveListOptions {
  /**
   * Rows rendered before the gate engages. Lists at or below this size
   * render fully and identically to an unvirtualized list — no sentinel,
   * no observer, no interaction with scroll.
   */
  initial: number;
  /** Rows appended each time the list-end sentinel approaches the viewport. */
  step: number;
}

export interface ProgressiveListResult<T> {
  /** The slice of `items` the caller renders this pass. */
  visible: readonly T[];
  /** True when `items` extends beyond `visible` and a sentinel is needed. */
  hasMore: boolean;
  /** Callback ref for the sentinel node rendered after the visible rows. */
  sentinelRef: (node: HTMLElement | null) => void;
}

/**
 * Distance from the viewport bottom at which the next chunk reveals. The
 * overlay panel spans the viewport, so a viewport-rooted observer with this
 * bottom margin watches the panel's internal scroll without owning it.
 */
const PROGRESSIVE_ROOT_MARGIN = "0px 0px 600px 0px";

/**
 * Frame-paced delay for the no-IntersectionObserver fallback reveal, so the
 * cascade converges to the full list at roughly one chunk per frame instead
 * of a same-tick burst (also makes it deterministic under fake timers).
 */
const PROGRESSIVE_FALLBACK_DELAY_MS = 16;

/**
 * Threshold-gated chunked rendering for long, unvirtualized lists. Keeps
 * the caller's markup (plain `<ul>` rows) and order unchanged: short lists
 * render fully, long lists mount in chunks so the first paint (and the
 * overlay's entrance animation) never blocks on hundreds of rows. Once the
 * last chunk is revealed the DOM matches the unchunked render 1:1.
 *
 * Reset is derived during the render pass (React's "adjust state when a
 * prop changes" pattern) so swapping datasets — e.g. another country's
 * city list — restarts at `initial` without an effect, and the visible
 * slice computed for that pass is already against the new dataset.
 *
 * Environments without IntersectionObserver degrade to step-wise reveals
 * on a timer cascade, which converges to the full unvirtualized list —
 * today's behavior.
 */
export function useProgressiveList<T>(
  items: readonly T[],
  { initial, step }: ProgressiveListOptions,
): ProgressiveListResult<T> {
  const sentinelNode = useRef<HTMLElement | null>(null);

  const [progress, setProgress] = useState<{
    items: readonly T[];
    count: number;
  }>(() => ({ items, count: Math.min(initial, items.length) }));

  const itemsChanged = progress.items !== items;
  const count = itemsChanged
    ? Math.min(initial, items.length)
    : progress.count;
  if (itemsChanged) {
    setProgress({ items, count });
  }

  const hasMore = count < items.length;
  const visible = items.slice(0, count);

  const sentinelRef = useCallback((node: HTMLElement | null) => {
    sentinelNode.current = node;
  }, []);

  useEffect(() => {
    const sentinel = sentinelNode.current;
    if (!sentinel || !hasMore) return;
    const reveal = () => {
      setProgress((p) =>
        p.items === items
          ? { items, count: Math.min(p.count + step, items.length) }
          : p,
      );
    };
    if (typeof IntersectionObserver === "undefined") {
      // No IntersectionObserver (SSR / minimal test DOM): keep revealing
      // on the frame-paced timer until the list exhausts or an observer
      // environment appears.
      const id = window.setTimeout(reveal, PROGRESSIVE_FALLBACK_DELAY_MS);
      return () => window.clearTimeout(id);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) reveal();
      },
      { rootMargin: PROGRESSIVE_ROOT_MARGIN, threshold: 0 },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [items, count, hasMore, step]);

  return { visible, hasMore, sentinelRef };
}
