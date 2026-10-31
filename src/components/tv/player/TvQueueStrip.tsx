"use client";

import Image from "next/image";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TvCard } from "@/types/tv";
import { cn } from "@/lib/utils/cn";
import { TvQueueItemSkeleton } from "@/components/tv/grid/TvCatalogSkeleton";
import {
  toTvMarqueeItems,
  type TvMarqueeItem,
} from "@/components/tv/marquee/tv-marquee-data";

interface TvQueueStripProps {
  queue: readonly TvCard[];
  activeId: string | null;
  onSelect: (id: string) => void;
  disabled?: boolean;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
}

function QueueThumb({ thumb }: { thumb: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!thumb || failed) {
    return (
      <span
        aria-hidden="true"
        className="flex h-full w-full items-center justify-center bg-wire-border font-display text-[9px] font-bold uppercase tracking-widest text-wire-muted"
      >
        TV
      </span>
    );
  }
  return (
    <Image
      src={thumb}
      alt=""
      fill
      sizes="128px"
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="object-cover"
    />
  );
}

interface TvQueueStripItemProps {
  item: TvMarqueeItem;
  index: number;
  active: boolean;
  disabled: boolean;
  onSelect: (id: string) => void;
}

const TvQueueStripItem = memo(function TvQueueStripItem({
  item,
  active,
  disabled,
  onSelect,
}: TvQueueStripItemProps) {
  return (
    <button
      type="button"
      data-queue-id={item.video.id}
      role="group"
      aria-roledescription="slide"
      aria-current={active ? "true" : undefined}
      aria-label={item.title}
      disabled={disabled}
      onClick={() => onSelect(item.video.id)}
      style={{ contentVisibility: "auto", containIntrinsicSize: "112px 76px" }}
      className={cn(
        "group relative w-auto max-w-60 min-w-52 shrink-0 snap-start overflow-hidden rounded-[10px] border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:opacity-40 landscape:w-20",
        active ? "border-on-wire" : "border-wire-border-strong hover:border-wire-muted",
      )}
    >
      <span className="relative block aspect-video w-full overflow-hidden bg-wire-border">
        <QueueThumb thumb={item.thumb} />
        {active ? (
          <span
            aria-hidden="true"
            className="absolute inset-0 ring-1 ring-inset ring-white"
          />
        ) : (
          <span
            aria-hidden="true"
            className="absolute inset-0 bg-black/30 transition-colors group-hover:bg-black/10"
          />
        )}
      </span>
      <span
        className={cn(
          "block truncate px-1.5 py-1 text-[10px] font-semibold leading-tight landscape:hidden",
          active ? "text-on-wire" : "text-wire-muted",
        )}
      >
        {item.title}
      </span>
    </button>
  );
});

export const TvQueueStrip = memo(function TvQueueStrip({
  queue,
  activeId,
  onSelect,
  disabled = false,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
}: TvQueueStripProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const lastScrollCheckRef = useRef(0);
  const items = useMemo(() => toTvMarqueeItems(queue), [queue]);

  // Keep the active thumb visible (respects reduced motion)
  useEffect(() => {
    if (!activeId) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const el = scroller.querySelector<HTMLElement>(
      `[data-queue-id="${CSS.escape(activeId)}"]`,
    );
    if (!el) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [activeId]);

  // Lazy loading observer: triggers onLoadMore as user approaches the queue end
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const scroller = scrollerRef.current;
    if (!sentinel || !hasMore || !onLoadMore || isLoadingMore || disabled)
      return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onLoadMore();
        }
      },
      { root: scroller, rootMargin: "0px 200px 0px 0px", threshold: 0 },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [hasMore, onLoadMore, isLoadingMore, disabled]);

  // Fallback scroll listener for environments where IntersectionObserver in nested dialog roots is suppressed
  const handleScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el || !hasMore || !onLoadMore || isLoadingMore || disabled) return;
    const now = Date.now();
    if (now - lastScrollCheckRef.current < 80) return;
    lastScrollCheckRef.current = now;
    if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 200) {
      onLoadMore();
    }
  }, [hasMore, onLoadMore, isLoadingMore, disabled]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  if (items.length === 0) return null;

  return (
    <div className="shrink-0 border-t border-wire-border bg-black px-2 py-2 sm:px-4 landscape:py-1">
      <div
        ref={scrollerRef}
        role="region"
        aria-label="Video queue"
        aria-roledescription="carousel"
        aria-busy={isLoadingMore}
        tabIndex={0}
        className="flex snap-x gap-2 overflow-x-auto overscroll-x-contain pb-0.5 no-scrollbar focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
      >
        {items.map((item, i) => (
          <TvQueueStripItem
            key={item.video.id}
            item={item}
            index={i}
            active={item.video.id === activeId}
            disabled={disabled}
            onSelect={onSelect}
          />
        ))}

        {/* Skeleton placeholder during in-flight page loading */}
        {isLoadingMore ? <TvQueueItemSkeleton /> : null}

        {/* Sentinel for queue lazy loading */}
        {hasMore ? (
          <div
            ref={sentinelRef}
            aria-hidden="true"
            className="w-1 shrink-0 snap-start self-stretch pointer-events-none"
          />
        ) : null}
      </div>
    </div>
  );
});
