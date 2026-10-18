"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  // Radio
} from "lucide-react";
// import { useUIStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils/cn";
import { MarqueeCard } from "./MarqueeCard";
import {
  toMarqueeItems,
  type MarqueeEventInput,
  type MarqueeSpotInput,
  type MarqueeVideoInput,
} from "./marquee-data";

interface LandingMarqueeProps {
  spots: readonly MarqueeSpotInput[];
  events: readonly MarqueeEventInput[];
  videos: readonly MarqueeVideoInput[];
  initialSeed: string;
  initialSpotsCursor: string | null;
  initialEventsCursor: string | null;
}

export function LandingMarquee({
  spots: initialSpots,
  events: initialEvents,
  videos,
  initialSeed,
  initialSpotsCursor,
  initialEventsCursor,
}: LandingMarqueeProps) {
  //   const openPreferences = useUIStore((s) => s.openPreferences);

  const [spots, setSpots] = useState<readonly MarqueeSpotInput[]>(initialSpots);
  const [events, setEvents] =
    useState<readonly MarqueeEventInput[]>(initialEvents);
  const [spotsCursor, setSpotsCursor] = useState<string | null>(
    initialSpotsCursor,
  );
  const [eventsCursor, setEventsCursor] = useState<string | null>(
    initialEventsCursor,
  );
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Keep seed stable — server set via cookie, passed as initialSeed.
  const seedRef = useRef(initialSeed);

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
    // Also observe viewport changes that affect card layout
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

  // Re-evaluate affordance when data grows (pagination)
  useEffect(() => {
    updateScrollState();
  }, [spots, events, videos, updateScrollState]);

  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    const hasSpotsMore = spotsCursor !== null;
    const hasEventsMore = eventsCursor !== null;
    if (!hasSpotsMore && !hasEventsMore) return;
    setLoadingMore(true);
    try {
      const fetches: Promise<void>[] = [];
      if (hasSpotsMore && spotsCursor) {
        fetches.push(
          fetch(
            `/api/spots?limit=12&random=true&hasImage=true&seed=${encodeURIComponent(seedRef.current)}&cursor=${encodeURIComponent(spotsCursor)}`,
          )
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
              if (data?.items?.length) {
                setSpots((prev) => {
                  const seen = new Set(prev.map((s) => s.id));
                  const next = (data.items as MarqueeSpotInput[]).filter(
                    (s) => !seen.has(s.id),
                  );
                  return [...prev, ...next];
                });
                setSpotsCursor(data.nextCursor ?? null);
              } else {
                setSpotsCursor(null);
              }
            })
            .catch(() => setSpotsCursor(null)),
        );
      }
      if (hasEventsMore && eventsCursor) {
        fetches.push(
          fetch(
            `/api/events?limit=12&random=true&seed=${encodeURIComponent(seedRef.current)}&cursor=${encodeURIComponent(eventsCursor)}`,
          )
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
              if (data?.items?.length) {
                setEvents((prev) => {
                  const seen = new Set(prev.map((e) => e.id));
                  const next = (data.items as MarqueeEventInput[]).filter(
                    (e) => !seen.has(e.id),
                  );
                  return [...prev, ...next];
                });
                setEventsCursor(data.nextCursor ?? null);
              } else {
                setEventsCursor(null);
              }
            })
            .catch(() => setEventsCursor(null)),
        );
      }
      await Promise.all(fetches);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, spotsCursor, eventsCursor]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const scroller = scrollerRef.current;
    if (!sentinel) return;
    // Use the scroller as root so prefetch is tied to horizontal scroll position
    // Fallback to viewport root if scroller not yet mounted (first paint).
    const io = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first?.isIntersecting) void loadMore();
      },
      {
        root: scroller ?? null,
        rootMargin: "0px 400px 0px 0px",
        threshold: 0,
      },
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

  const displayItems = useMemo(
    () => toMarqueeItems({ spots, events, videos, seed: initialSeed }),
    [spots, events, videos, initialSeed],
  );

  if (displayItems.length === 0) {
    return (
      <section
        aria-label="Open Spot wire"
        className="shrink-0 border-t border-wire-border bg-wire"
      >
        {/* <WireRail count={0} onPersonalize={openPreferences} /> */}
        <div className="px-4 py-6 text-center text-sm text-white/70">
          No highlights yet — check back soon.
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="Open Spot wire"
      className="shrink-0 border-t border-wire-border bg-wire h-2/5"
    >
      {/* <WireRail count={displayItems.length} onPersonalize={openPreferences} /> */}

      <div className="group/wire relative bg-wire h-[36vh]">
        {/* Edge fades — state-driven like EventCarousel, not always-on */}
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

        {/* Netflix/Prime-style chevrons — hidden on mobile (swipe), visible on sm+ */}
        <button
          type="button"
          aria-label="Scroll highlights left"
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
          aria-label="Scroll highlights right"
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
          aria-label="Highlights"
          aria-roledescription="carousel"
          aria-busy={loadingMore}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          className="h-full flex items-center snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth overscroll-x-contain scroll-px-3 px-3 py-[clamp(6px,1.2dvh,12px)] no-scrollbar bg-wire focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-wire focus-visible:rounded-none sm:scroll-px-10 sm:px-10"
        >
          {displayItems.map((item) => (
            <div
              key={`${item.kind}-${item.id}`}
              data-marquee-card
              className="shrink-0 snap-start"
              role="group"
              aria-roledescription="slide"
              aria-label={`${item.title}`}
            >
              <MarqueeCard item={item} />
            </div>
          ))}
          {/* Sentinel for lazy pagination — at end of scrollable row */}
          <div
            ref={sentinelRef}
            aria-hidden="true"
            className="w-1 shrink-0 snap-start self-stretch"
          />
        </div>
        {/* Transparent loading veil — no layout shift, no message */}
        {loadingMore ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10 bg-wire/20"
          />
        ) : null}
        {/* SR-only live region for a11y, no visual jump */}
        <span aria-live="polite" className="sr-only">
          {loadingMore ? "Loading more highlights" : ""}
        </span>
      </div>
    </section>
  );
}

// function WireRail({
//   count,
//   onPersonalize,
// }: {
//   count: number;
//   onPersonalize: () => void;
// }) {
//   return (
//     <div className="flex flex-wrap items-center gap-1.5 border-b border-wire-border bg-wire px-3 py-[clamp(6px,1.2dvh,12px)] sm:px-10">
//       <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-2.5 py-[5px] font-display text-[10px] font-bold uppercase tracking-[0.08em] leading-none text-white/90 backdrop-blur-sm">
//         <Radio size={10} aria-hidden="true" className="text-white" />
//         All disciplines
//       </span>

//       <span className="hidden font-display text-[10px] uppercase tracking-[0.08em] leading-none text-white/60 sm:inline">
//         · {count} highlights
//       </span>

//       <span className="ml-auto inline-flex items-center gap-1.5">
//         <button
//           type="button"
//           onClick={onPersonalize}
//           className="inline-flex min-h-7 items-center rounded-full border border-white/15 bg-white/10 px-3 font-display text-[10px] font-bold uppercase tracking-[0.08em] leading-none text-white backdrop-blur-sm transition-colors duration-150 ease-out hover:border-white/25 hover:bg-white/15 active:bg-white/20 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-wire"
//         >
//           Personalize
//         </button>
//       </span>
//     </div>
//   );
// }
