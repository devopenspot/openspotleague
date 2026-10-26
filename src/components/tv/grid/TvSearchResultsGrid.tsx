"use client";

import { memo, useMemo, useState } from "react";
import Image from "next/image";
import { Search, Tv, X, Loader2 } from "lucide-react";
import type { TvCard } from "@/types/tv";
import { cn } from "@/lib/utils/cn";
import {
  formatTvCategory,
  toTvMarqueeItem,
} from "@/components/tv/marquee/tv-marquee-data";
import { TvBrandMark } from "@/components/tv/marquee/TvBrandMark";

export interface TvSearchResultsGridProps {
  items: readonly TvCard[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  activeId: string | null;
  onSelectVideo: (video: TvCard) => void;
  query: string;
  onClearQuery: () => void;
  discipline: string;
  disciplineLabel: string;
  onClearDiscipline: () => void;
  category: string;
  onClearCategory: () => void;
  year: number | null;
  onClearYear: () => void;
  onResetAll: () => void;
}

function CardImage({ thumb }: { thumb: string | null }) {
  const [failed, setFailed] = useState(false);
  const showFallback = !thumb || failed;

  if (showFallback) {
    return (
      <div
        aria-hidden="true"
        className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-wire-border px-2 text-wire-muted"
        style={{
          backgroundImage:
            "linear-gradient(color-mix(in srgb, var(--color-on-wire) 18%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--color-on-wire) 14%, transparent) 1px, transparent 1px)",
          backgroundSize: "14px 14px",
        }}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-wire-border-strong bg-wire-border-strong text-on-wire shadow-sm">
          <Tv size={14} aria-hidden="true" />
        </span>
        <span className="font-display text-[9px] font-bold uppercase tracking-[0.08em] leading-none text-wire-muted">
          TV
        </span>
      </div>
    );
  }

  return (
    <Image
      src={thumb}
      alt=""
      fill
      sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="object-cover transition-transform duration-300 motion-safe:group-hover/card:scale-[1.02]"
    />
  );
}

const TvSearchCard = memo(function TvSearchCard({
  video,
  active,
  onSelect,
}: {
  video: TvCard;
  active?: boolean;
  onSelect: (video: TvCard) => void;
}) {
  const item = useMemo(() => toTvMarqueeItem(video), [video]);

  return (
    <button
      type="button"
      onClick={() => onSelect(video)}
      aria-label={`${item.title} — ${item.disciplineSlug} · ${item.meta}`}
      className="group/card flex w-full flex-col gap-2 text-left focus-visible:outline-none"
    >
      <div
        className={cn(
          "relative aspect-video w-full overflow-hidden rounded-md bg-wire-border transition-[box-shadow,transform] duration-150 ease-out group-active/card:scale-[0.99] group-focus-visible/card:ring-2 group-focus-visible/card:ring-white group-focus-visible/card:ring-offset-2 group-focus-visible/card:ring-offset-wire",
          active && "ring-2 ring-on-wire",
        )}
      >
        <CardImage thumb={item.thumb} />
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent"
        />
        <span className="absolute left-2 top-2 inline-flex items-center rounded bg-white px-1.5 py-[3px] font-display text-[10px] font-bold uppercase leading-none tracking-wide text-black">
          <span className="truncate max-w-[14ch]">
            {item.isNew ? "New" : item.disciplineSlug}
          </span>
        </span>
        <TvBrandMark />
      </div>

      <div className="flex flex-col gap-0.5 px-0.5 min-w-0">
        <p className="line-clamp-2 text-[13px] sm:text-sm font-medium leading-snug text-white/90 transition-colors group-hover/card:text-white">
          {item.title}
        </p>
        <div className="flex items-center justify-between gap-2 text-xs text-white/50">
          <span className="truncate">
            {item.isNew ? `${item.disciplineSlug} · ${item.meta}` : item.meta}
          </span>
          {video.categories[0] ? (
            <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/70">
              {video.categories[0]}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
});

function TvSearchSkeletonCard() {
  return (
    <div className="flex flex-col overflow-hidden rounded-[14px] border border-wire-border bg-wire ">
      <div className="aspect-video w-full bg-white/5" />
      <div className="space-y-2 p-3">
        <div className="h-4 w-3/4 rounded bg-white/10" />
        <div className="h-3 w-1/3 rounded bg-white/5" />
      </div>
    </div>
  );
}

export function TvSearchResultsGrid({
  items,
  isLoading,
  isLoadingMore,
  hasMore,
  onLoadMore,
  activeId,
  onSelectVideo,
  query,
  onClearQuery,
  discipline,
  disciplineLabel,
  onClearDiscipline,
  category,
  onClearCategory,
  year,
  onClearYear,
  onResetAll,
}: TvSearchResultsGridProps) {
  const hasActiveFilters = Boolean(
    query.trim() ||
    discipline !== "all" ||
    (category && category !== "all") ||
    year !== null,
  );

  return (
    <div className="space-y-4 pt-2">
      {/* Search Header: Match count & active filter pills */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-white/70">
          <span className="font-display font-bold uppercase tracking-wider text-white">
            {isLoading
              ? "Searching..."
              : `${items.length} ${items.length === 1 ? "video" : "videos"} found`}
          </span>

          {hasActiveFilters ? (
            <div className="flex flex-wrap items-center gap-1.5 pl-2">
              {query.trim() ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[10px] font-bold uppercase text-white">
                  <span>&ldquo;{query.trim()}&rdquo;</span>
                  <button
                    type="button"
                    onClick={onClearQuery}
                    aria-label="Remove query filter"
                    className="hover:text-red-400"
                  >
                    <X size={11} aria-hidden="true" />
                  </button>
                </span>
              ) : null}

              {discipline !== "all" ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[10px] font-bold uppercase text-white">
                  <span>{disciplineLabel}</span>
                  <button
                    type="button"
                    onClick={onClearDiscipline}
                    aria-label="Remove discipline filter"
                    className="hover:text-red-400"
                  >
                    <X size={11} aria-hidden="true" />
                  </button>
                </span>
              ) : null}

              {category && category !== "all" ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[10px] font-bold uppercase text-white">
                  <span>{formatTvCategory(category)}</span>
                  <button
                    type="button"
                    onClick={onClearCategory}
                    aria-label="Remove category filter"
                    className="hover:text-red-400"
                  >
                    <X size={11} aria-hidden="true" />
                  </button>
                </span>
              ) : null}

              {year !== null ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[10px] font-bold uppercase text-white">
                  <span>{year}</span>
                  <button
                    type="button"
                    onClick={onClearYear}
                    aria-label="Remove year filter"
                    className="hover:text-red-400"
                  >
                    <X size={11} aria-hidden="true" />
                  </button>
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        {hasActiveFilters ? (
          <button
            type="button"
            onClick={onResetAll}
            className="text-xs text-white/60 hover:text-white underline underline-offset-4 transition-colors"
          >
            Clear all
          </button>
        ) : null}
      </div>

      {/* Grid Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <TvSearchSkeletonCard key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-[16px] border border-white/10 bg-white/[0.04] px-4 py-12 sm:px-6 sm:py-16 text-center">
          <Search
            size={32}
            className="mx-auto text-white/30"
            aria-hidden="true"
          />
          <p className="mt-4 text-base font-semibold text-white">
            No videos match your search
          </p>
          <p className="mt-1.5 text-xs text-white/60 max-w-sm mx-auto">
            Try adjusting your search terms or clearing some filters to explore
            more sessions.
          </p>
          <button
            type="button"
            onClick={onResetAll}
            className="mt-4 rounded-full bg-white px-5 py-2 font-display text-[11px] font-bold uppercase tracking-wider text-black hover:bg-white/90 transition-colors"
          >
            Reset all filters
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {items.map((video) => (
              <TvSearchCard
                key={video.id}
                video={video}
                active={video.id === activeId}
                onSelect={onSelectVideo}
              />
            ))}
          </div>

          {/* Load More Button */}
          {hasMore ? (
            <div className="flex justify-center pt-6 pb-2">
              <button
                type="button"
                onClick={onLoadMore}
                disabled={isLoadingMore}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-6 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-white hover:bg-white/20 disabled:opacity-50 transition-all active:scale-[0.98]"
              >
                {isLoadingMore ? (
                  <>
                    <Loader2
                      size={14}
                      className="animate-spin"
                      aria-hidden="true"
                    />
                    <span>Loading more videos...</span>
                  </>
                ) : (
                  <span>Load more videos</span>
                )}
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
