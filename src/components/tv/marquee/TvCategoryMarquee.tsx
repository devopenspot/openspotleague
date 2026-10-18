"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { TvCard, TvCategory } from "@/types/tv";
import { cn } from "@/lib/utils/cn";
import { TvMarqueeCard } from "./TvMarqueeCard";
import { toTvMarqueeItems } from "./tv-marquee-data";

const ROW_PAGE_LIMIT = 12;

interface TvCategoryMarqueeProps {
  category: TvCategory;
  videos: readonly TvCard[];
  /** First-page cursor from the server (null when the row fits one page). */
  initialCursor: string | null;
  /** Active discipline filter (server-side, "all" = unfiltered). */
  discipline: string;
  activeId: string | null;
  onSelect: (video: TvCard) => void;
  /** Merges appended pages into the grid theater queue/modal lookup. */
  onAppend: (
    videos: readonly TvCard[],
    category?: TvCategory,
    nextCursor?: string | null,
  ) => void;
}

export const TvCategoryMarquee = memo(function TvCategoryMarquee({
  category,
  videos: initialVideos,
  initialCursor,
  discipline,
  activeId,
  onSelect,
  onAppend,
}: TvCategoryMarqueeProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [videos, setVideos] = useState<readonly TvCard[]>(initialVideos);
  const [cursor, setCursor] = useState<string | null>(initialCursor);

  const [loadingMore, setLoadingMore] = useState(false);
  // Single-flight guard — loadingMore state alone lags one render behind
  // the rapid-fire intersection callback, so scroll bursts could double
  // the page query (an extra Pooler round-trip + invocation for nothing).
  const loadingRef = useRef(false);
  // Abortable in-flight page fetch — aborted on server-row adoption and
  // on dispose, so stale pages never land in the fresh row.
  const inFlightAbortRef = useRef<AbortController | null>(null);
  // Server row replacement (discipline switch / refetch): adopt the fresh
  // first page instead of staying stuck on mount-time data. Parent memos
  // only change these identities on real payload changes; `setCursor` with
  // an unchanged value bails out, so pagination survives own appends.
  // Any page request still in flight belongs to the stale payload — abort
  // it here so a crossing page never appends into the fresh row.
  useEffect(() => {
    inFlightAbortRef.current?.abort();
    inFlightAbortRef.current = null;
    loadingRef.current = false;
    setVideos(initialVideos);
    setCursor(initialCursor);
  }, [initialVideos, initialCursor]);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 8);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 8);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    const hasRO = typeof ResizeObserver !== "undefined";
    const ro = hasRO ? new ResizeObserver(updateScrollState) : null;
    if (ro) ro.observe(el);
    if (typeof window !== "undefined") {
      window.addEventListener("resize", updateScrollState);
    }
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      if (ro) ro.disconnect();
      if (typeof window !== "undefined") {
        window.removeEventListener("resize", updateScrollState);
      }
    };
  }, [updateScrollState]);

  useEffect(() => {
    updateScrollState();
  }, [videos, updateScrollState]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !cursor) return;
    loadingRef.current = true;
    setLoadingMore(true);
    const ac = new AbortController();
    inFlightAbortRef.current = ac;
    try {
      const params = new URLSearchParams();
      params.set("limit", String(ROW_PAGE_LIMIT));
      params.set("category", category);
      if (discipline !== "all") params.set("discipline", discipline);
      params.set("cursor", cursor);
      const res = await fetch(`/api/tv?${params.toString()}`, {
        signal: ac.signal,
      });
      if (ac.signal.aborted) return;
      if (!res.ok) {
        setCursor(null);
        return;
      }
      const data = (await res.json()) as {
        items?: unknown;
        nextCursor?: unknown;
      };
      if (ac.signal.aborted) return;
      const items = Array.isArray(data.items)
        ? (data.items.filter(
            (v): v is TvCard =>
              typeof v === "object" &&
              v !== null &&
              typeof (v as TvCard).id === "string",
          ) ?? [])
        : [];
      setVideos((prev) => {
        const seen = new Set(prev.map((v) => v.id));
        return [...prev, ...items.filter((v) => !seen.has(v.id))];
      });
      const nextC = typeof data.nextCursor === "string" ? data.nextCursor : null;
      onAppend(items, category, nextC);
      setCursor(nextC);
    } catch (error) {
      if ((error as { name?: string } | null)?.name === "AbortError") return;
      setCursor(null);
    } finally {
      if (inFlightAbortRef.current === ac) inFlightAbortRef.current = null;
      loadingRef.current = false;
      setLoadingMore(false);
    }
  }, [cursor, category, discipline, onAppend]);

  // Abort any in-flight page when the row goes away (unmount).
  useEffect(() => () => inFlightAbortRef.current?.abort(), []);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const scroller = scrollerRef.current;
    if (!sentinel) return;
    // Scroller root ties prefetch to horizontal scroll position. 200px
    // near the row end is enough headroom for page swaps without paying
    // for several extra pages users never scroll to.
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { root: scroller ?? null, rootMargin: "0px 200px 0px 0px", threshold: 0 },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [loadMore]);

  const scrollBy = useCallback((dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-marquee-card]");
    const gap = 8; // gap-2
    const amount = card ? card.offsetWidth + gap : 240;
    el.scrollBy({ left: dir * amount, behavior: "smooth" });
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        scrollBy(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        scrollBy(1);
      } else if (e.key === "Home") {
        e.preventDefault();
        scrollerRef.current?.scrollTo({ left: 0, behavior: "smooth" });
      } else if (e.key === "End") {
        e.preventDefault();
        const el = scrollerRef.current;
        if (el) el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
      }
    },
    [scrollBy],
  );

  const displayItems = useMemo(() => toTvMarqueeItems(videos), [videos]);

  if (displayItems.length === 0) return null;

  return (
    <section
      aria-label={`${category} sessions`}
      className="shrink-0 border-t border-wire-border bg-wire"
    >
      <div className="flex items-center gap-1.5 bg-wire px-0 pt-[clamp(6px,1.2dvh,12px)]">
        <span className="inline-flex items-center gap-1 rounded-full border border-wire-border bg-wire-border px-2.5 py-[5px] font-display text-[10px] font-bold uppercase tracking-[0.08em] leading-none text-white/90">
          {category}
        </span>
      </div>

      <div className="group/wire relative bg-wire h-[36vh]">
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-wire to-transparent transition-opacity sm:w-10",
            canScrollLeft ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-wire to-transparent transition-opacity sm:w-10",
            canScrollRight ? "opacity-100" : "opacity-0",
          )}
        />

        <button
          type="button"
          aria-label={`Scroll ${category} sessions left`}
          onClick={() => scrollBy(-1)}
          disabled={!canScrollLeft}
          className={cn(
            "absolute left-1 top-1/2 z-20 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border bg-wire text-white shadow-sm transition-[opacity,background-color,transform,border-color] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-wire sm:flex sm:h-9 sm:w-9",
            canScrollLeft
              ? "border-white/15 opacity-100 hover:bg-white/15 hover:border-white/25 active:bg-white/20 active:scale-[0.98]"
              : "pointer-events-none border-white/10 opacity-30",
          )}
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={`Scroll ${category} sessions right`}
          onClick={() => scrollBy(1)}
          disabled={!canScrollRight}
          className={cn(
            "absolute right-1 top-1/2 z-20 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border bg-wire text-white shadow-sm transition-[opacity,background-color,transform,border-color] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-wire sm:flex sm:h-9 sm:w-9",
            canScrollRight
              ? "border-white/15 opacity-100 hover:bg-white/15 hover:border-white/25 active:bg-white/20 active:scale-[0.98]"
              : "pointer-events-none border-white/10 opacity-30",
          )}
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>

        <div
          ref={scrollerRef}
          role="region"
          aria-label={`${category} sessions`}
          aria-roledescription="carousel"
          aria-busy={loadingMore}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          className="h-full flex items-center snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth overscroll-x-contain scroll-px-3 px-0 py-[clamp(6px,1.2dvh,12px)] no-scrollbar bg-wire focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-wire focus-visible:rounded-none sm:scroll-px-10 "
        >
          {displayItems.map((item) => (
            <div
              key={`${item.video.id}`}
              data-marquee-card
              className="shrink-0 snap-start"
              role="group"
              aria-roledescription="slide"
              aria-label={`${item.title}`}
            >
              <TvMarqueeCard
                item={item}
                active={item.video.id === activeId}
                onSelect={onSelect}
              />
            </div>
          ))}
          {/* Sentinel for row pagination — at end of scrollable row */}
          {cursor ? (
            <div
              ref={sentinelRef}
              aria-hidden="true"
              className="w-1 shrink-0 snap-start self-stretch"
            />
          ) : null}
        </div>
        {/* Transparent loading veil — no layout shift, no message */}
        {loadingMore ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10 bg-wire/20"
          />
        ) : null}
      </div>
    </section>
  );
});
