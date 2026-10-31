"use client";

import { memo, useEffect, useRef } from "react";
import type { TvCategory } from "@/types/tv";
import { cn } from "@/lib/utils/cn";
import { formatTvCategory } from "@/components/tv/marquee/tv-marquee-data";

export type TheaterCategory = TvCategory | "all";

interface TvCategoryPillsProps {
  options: readonly { category: TvCategory; count?: number }[];
  total?: number;
  selected: TheaterCategory;
  onSelect: (category: TheaterCategory) => void;
  disabled?: boolean;
}

function pillClassName(active: boolean): string {
  return cn(
    "inline-flex h-8 sm:h-7.5 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-3 sm:px-2.5 font-display text-[11px] sm:text-[10px] font-bold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:opacity-40 touch-manipulation landscape:h-6.5 landscape:px-2.5 landscape:text-[9.5px]",
    active
      ? "border-on-wire bg-on-wire text-black"
      : "border-wire-border-strong bg-wire-border text-on-wire hover:bg-wire-border-strong",
  );
}

export const TvCategoryPills = memo(function TvCategoryPills({
  options,
  selected,
  onSelect,
  disabled = false,
}: TvCategoryPillsProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // One scrolling line: keep the active pill in view when opened from a row
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>('[aria-pressed="true"]')
      ?.scrollIntoView?.({ inline: "center", block: "nearest" });
  }, [selected]);

  return (
    <div
      ref={listRef}
      role="group"
      aria-label="Filter queue by category"
      className="flex snap-x gap-1.5 overflow-x-auto overscroll-x-contain px-3 py-1.5 no-scrollbar touch-pan-x sm:px-4 landscape:py-0.5"
    >
      <button
        type="button"
        aria-pressed={selected === "all"}
        aria-label="All categories"
        disabled={disabled}
        onClick={() => onSelect("all")}
        className={pillClassName(selected === "all")}
      >
        All
      </button>
      {options.map(({ category }) => {
        const active = selected === category;
        const label = formatTvCategory(category);
        return (
          <button
            key={category}
            type="button"
            aria-pressed={active}
            aria-label={label}
            disabled={disabled}
            onClick={() => onSelect(category)}
            className={pillClassName(active)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
});
