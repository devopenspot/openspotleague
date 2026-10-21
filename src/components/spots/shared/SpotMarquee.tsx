"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface SpotMarqueeProps<T> {
  items: readonly T[];
  renderItem: (item: T, index: number) => ReactNode;
  getItemKey?: (item: T, index: number) => string;
  ariaLabel: string;
  className?: string;
  cardClassName?: string;
  edgeFadeClass?: {
    left?: string;
    right?: string;
  };
}

export function SpotMarquee<T extends { id?: string }>({
  items,
  renderItem,
  getItemKey,
  ariaLabel,
  className,
  cardClassName,
  edgeFadeClass,
}: SpotMarqueeProps<T>) {
  const scrollerRef = useRef<HTMLDivElement>(null);
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
  }, [items, updateScrollState]);

  const scrollBy = useCallback((dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-marquee-card]");
    const gap = 16;
    const amount = card ? card.offsetWidth + gap : 300;
    el.scrollBy({ left: dir * amount, behavior: "smooth" });
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
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

  if (items.length === 0) return null;

  const leftFade = edgeFadeClass?.left ?? "from-surface-container-low to-transparent";
  const rightFade = edgeFadeClass?.right ?? "from-surface-container-low to-transparent";

  return (
    <div className={cn("group/marquee relative", className)}>
      {/* Edge gradient masks for scroll affordance */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r transition-opacity duration-200 sm:w-12",
          leftFade,
          canScrollLeft ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l transition-opacity duration-200 sm:w-12",
          rightFade,
          canScrollRight ? "opacity-100" : "opacity-0",
        )}
      />

      {/* Floating desktop scroll controls */}
      <button
        type="button"
        aria-label="Scroll left"
        onClick={() => scrollBy(-1)}
        disabled={!canScrollLeft}
        tabIndex={canScrollLeft ? 0 : -1}
        className={cn(
          "absolute left-2 top-1/2 z-20 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-outline-variant bg-surface text-on-surface shadow-sm transition-[opacity,background-color,border-color,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 hover:bg-surface-container active:scale-95 sm:flex",
          canScrollLeft
            ? "cursor-pointer opacity-100 hover:border-outline"
            : "pointer-events-none opacity-0",
        )}
      >
        <ChevronLeft size={16} aria-hidden="true" />
      </button>

      <button
        type="button"
        aria-label="Scroll right"
        onClick={() => scrollBy(1)}
        disabled={!canScrollRight}
        tabIndex={canScrollRight ? 0 : -1}
        className={cn(
          "absolute right-2 top-1/2 z-20 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-outline-variant bg-surface text-on-surface shadow-sm transition-[opacity,background-color,border-color,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 hover:bg-surface-container active:scale-95 sm:flex",
          canScrollRight
            ? "cursor-pointer opacity-100 hover:border-outline"
            : "pointer-events-none opacity-0",
        )}
      >
        <ChevronRight size={16} aria-hidden="true" />
      </button>

      {/* Marquee scroller rail */}
      <div
        ref={scrollerRef}
        role="region"
        aria-label={ariaLabel}
        aria-roledescription="carousel"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="flex items-start snap-x snap-mandatory gap-3 sm:gap-4 overflow-x-auto scroll-smooth overscroll-x-contain no-scrollbar py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:rounded-lg"
      >
        {items.map((item, idx) => {
          const key = getItemKey
            ? getItemKey(item, idx)
            : item.id ?? String(idx);
          return (
            <div
              key={key}
              data-marquee-card
              role="group"
              aria-roledescription="slide"
              aria-label={`${idx + 1} of ${items.length}`}
              className={cn(
                "w-[82vw] max-w-[280px] shrink-0 snap-start sm:w-auto sm:min-w-[300px] lg:min-w-[320px]",
                cardClassName,
              )}
            >
              {renderItem(item, idx)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
