"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { EventCard } from "@/components/sport-events/cards/EventCard";
import type { SportEventEnriched } from "@/types/sport-events";
import { cn } from "@/lib/utils/cn";

interface EventCarouselProps {
  events: readonly SportEventEnriched[];
  ariaLabel?: string;
}

export function EventCarousel({
  events,
  ariaLabel = "Event shelf",
}: EventCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const updateState = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 8);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 8);

    // approximate active index by scroll position
    const cardWidth = 340; // lg:min-w-[340px] + gap 20 => ~360
    const gap = 20;
    const idx = Math.round(scrollLeft / (cardWidth + gap));
    setActiveIndex(Math.max(0, Math.min(events.length - 1, idx)));
  }, [events.length]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateState();
    el.addEventListener("scroll", updateState, { passive: true });
    const hasRO = typeof ResizeObserver !== "undefined";
    const ro = hasRO ? new ResizeObserver(updateState) : null;
    if (ro) ro.observe(el);
    if (typeof window !== "undefined") {
      window.addEventListener("resize", updateState);
    }
    return () => {
      el.removeEventListener("scroll", updateState);
      if (ro) ro.disconnect();
      if (typeof window !== "undefined") {
        window.removeEventListener("resize", updateState);
      }
    };
  }, [updateState]);

  const scrollBy = useCallback((dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-event-card]");
    const gap = 20;
    const amount = card ? card.offsetWidth + gap : 360;
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

  if (events.length === 0) return null;

  return (
    <div className="w-full min-w-0">
      {/* Mobile + tablet: vertical grid — no horizontal break, fluid vertical slice */}
      <div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:hidden"
        role="list"
        aria-label={`${ariaLabel} — grid`}
      >
        {events.map((event, idx) => (
          <div key={event.id} role="listitem" className="min-w-0">
            <EventCard event={event} priority={idx === 0} />
          </div>
        ))}
      </div>

      {/* Desktop: controlled horizontal carousel with fluid snap + affordance */}
      <div className="relative hidden lg:block">
        {/* fade affordance when scrollable */}
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-surface to-transparent transition-opacity",
            canScrollLeft ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-surface to-transparent transition-opacity",
            canScrollRight ? "opacity-100" : "opacity-0",
          )}
        />

        {/* prev / next controls */}
        <button
          type="button"
          aria-label="Previous events"
          onClick={() => scrollBy(-1)}
          disabled={!canScrollLeft}
          className={cn(
            "absolute left-2 top-[168px] z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border bg-surface-container-lowest text-on-surface shadow-sm transition-[opacity,background-color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 lg:flex",
            canScrollLeft
              ? "border-outline-variant opacity-100 hover:bg-surface-container-low"
              : "pointer-events-none border-outline-variant/40 opacity-40",
          )}
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Next events"
          onClick={() => scrollBy(1)}
          disabled={!canScrollRight}
          className={cn(
            "absolute right-2 top-[168px] z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border bg-surface-container-lowest text-on-surface shadow-sm transition-[opacity,background-color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 lg:flex",
            canScrollRight
              ? "border-outline-variant opacity-100 hover:bg-surface-container-low"
              : "pointer-events-none border-outline-variant/40 opacity-40",
          )}
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>

        <div
          ref={scrollerRef}
          role="region"
          aria-label={`${ariaLabel} — carousel`}
          aria-roledescription="carousel"
          tabIndex={0}
          onKeyDown={handleKeyDown}
          className="flex gap-5 overflow-x-auto scroll-smooth pb-4 pt-1 snap-x snap-mandatory scroll-px-6 no-scrollbar focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:rounded-[16px]"
        >
          {events.map((event, idx) => (
            <div
              key={event.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${idx + 1} of ${events.length}`}
              className="w-[320px] max-w-[85vw] shrink-0 snap-start sm:w-[340px] min-w-0"
            >
              <EventCard event={event} priority={idx === 0} />
            </div>
          ))}
        </div>

        {/* dots progress (desktop only) */}
        {events.length > 1 && (
          <div
            className="mt-2 hidden items-center justify-center gap-1.5 lg:flex"
            role="tablist"
            aria-label="Carousel pagination"
          >
            {events.map((_, idx) => (
              <button
                key={idx}
                type="button"
                role="tab"
                aria-selected={idx === activeIndex}
                aria-label={`Go to slide ${idx + 1}`}
                onClick={() => {
                  const el = scrollerRef.current;
                  if (!el) return;
                  const card = el.querySelector<HTMLElement>("[data-event-card]");
                  const gap = 20;
                  const amount = card ? card.offsetWidth + gap : 360;
                  el.scrollTo({ left: idx * amount, behavior: "smooth" });
                }}
                className="flex h-6 w-6 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-2 w-2 rounded-full transition-colors",
                    idx === activeIndex ? "bg-primary" : "bg-outline-variant",
                  )}
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
