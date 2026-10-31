"use client";

import { Search, X } from "lucide-react";
import type { TvCard } from "@/types/tv";
import {
  formatTvCategory,
  toTvMarqueeItem,
} from "@/components/tv/marquee/tv-marquee-data";
import { TvMarqueeCard } from "@/components/tv/marquee/TvMarqueeCard";
import { TvCardSkeleton } from "./TvCatalogSkeleton";

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

function FilterChip({
  label,
  removeLabel,
  onRemove,
}: {
  label: string;
  removeLabel: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-wire-border-strong bg-wire-border px-2.5 py-0.5 text-[10px] font-bold uppercase text-on-wire">
      <span>{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        className="text-wire-muted transition-colors hover:text-on-wire"
      >
        <X size={11} aria-hidden="true" />
      </button>
    </span>
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
  const isEmpty = !isLoading && items.length === 0;

  return (
    <div className="space-y-4 pt-2">
      {/* Search Header: Match count & active filter pills */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-wire-border pb-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-wire-muted">
          <span className="font-display font-bold uppercase tracking-wider text-on-wire">
            {isLoading
              ? "Searching…"
              : `${items.length} ${items.length === 1 ? "video" : "videos"} found`}
          </span>

          {hasActiveFilters ? (
            <div className="flex flex-wrap items-center gap-1.5 pl-2">
              {query.trim() ? (
                <FilterChip
                  label={`“${query.trim()}”`}
                  removeLabel="Remove query filter"
                  onRemove={onClearQuery}
                />
              ) : null}

              {discipline !== "all" ? (
                <FilterChip
                  label={disciplineLabel}
                  removeLabel="Remove sport filter"
                  onRemove={onClearDiscipline}
                />
              ) : null}

              {category && category !== "all" ? (
                <FilterChip
                  label={formatTvCategory(category)}
                  removeLabel="Remove category filter"
                  onRemove={onClearCategory}
                />
              ) : null}

              {year !== null ? (
                <FilterChip
                  label={String(year)}
                  removeLabel="Remove year filter"
                  onRemove={onClearYear}
                />
              ) : null}
            </div>
          ) : null}
        </div>

        {hasActiveFilters && !isEmpty ? (
          <button
            type="button"
            onClick={onResetAll}
            className="text-xs text-wire-muted underline underline-offset-4 transition-colors hover:text-on-wire"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {/* Grid Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <TvCardSkeleton key={i} fluid />
          ))}
        </div>
      ) : isEmpty ? (
        <div className="rounded-[16px] border border-wire-border bg-tv-overlay px-4 py-12 text-center sm:px-6 sm:py-16">
          <Search
            size={32}
            className="mx-auto text-wire-muted"
            aria-hidden="true"
          />
          <p className="mt-4 text-base font-semibold text-on-wire">
            No videos match your search
          </p>
          <p className="mx-auto mt-1.5 max-w-sm text-xs text-wire-muted">
            Try a rider name or trick, or clear your filters.
          </p>
          <button
            type="button"
            onClick={onResetAll}
            className="mt-4 rounded-full bg-on-wire px-5 py-2 font-display text-[13px] font-semibold text-black transition-colors hover:bg-on-wire/90"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {items.map((video) => (
              <TvMarqueeCard
                key={video.id}
                item={toTvMarqueeItem(video)}
                active={video.id === activeId}
                onSelect={onSelectVideo}
                fluid
              />
            ))}
            {isLoadingMore
              ? Array.from({ length: 4 }).map((_, i) => (
                  <TvCardSkeleton key={i} fluid />
                ))
              : null}
          </div>

          {/* Load More Button */}
          {hasMore ? (
            <div className="flex justify-center pt-6 pb-2">
              <button
                type="button"
                onClick={onLoadMore}
                disabled={isLoadingMore}
                className="inline-flex items-center gap-2 rounded-full border border-wire-border-strong bg-wire-border px-6 py-2.5 font-display text-[13px] font-semibold text-on-wire transition-all hover:bg-wire-border-strong active:scale-[0.98] disabled:opacity-50"
              >
                {isLoadingMore ? "Loading…" : "Load more videos"}
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
