"use client";

import { useId } from "react";
import { Search, X, ChevronDown, RotateCcw } from "lucide-react";
import { formatTvCategory } from "@/components/tv/marquee/tv-marquee-data";

export interface TvFilterBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  categories: readonly string[];
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  years: readonly number[];
  selectedYear: number | null;
  onSelectYear: (year: number | null) => void;
  totalActiveFiltersCount: number;
  onReset: () => void;
}

export function TvFilterBar({
  query,
  onQueryChange,
  categories,
  selectedCategory,
  onSelectCategory,
  years,
  selectedYear,
  onSelectYear,
  totalActiveFiltersCount,
  onReset,
}: TvFilterBarProps) {
  const searchInputId = useId();
  const categorySelectId = useId();
  const yearSelectId = useId();

  const isFiltered = totalActiveFiltersCount > 0;

  return (
    <div
      role="search"
      aria-label="Filter TV videos"
      className="flex flex-col gap-2.5 sm:gap-3 py-1"
    >
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2.5">
        {/* Text Input: Name / Title */}
        <div className="relative flex-1 min-w-[200px]">
          <label htmlFor={searchInputId} className="sr-only">
            Search videos by name
          </label>
          <Search
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40"
            aria-hidden="true"
          />
          <input
            id={searchInputId}
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search videos by name..."
            autoComplete="off"
            spellCheck="false"
            className="w-full rounded-full border border-white/15 bg-white/10 pl-9 pr-9 py-1.5 sm:py-2 min-h-[36px] text-base sm:text-xs font-medium text-white placeholder:text-white/40 focus:border-white focus:outline-none focus:ring-1 focus:ring-white transition-colors"
          />
          {query ? (
            <button
              type="button"
              onClick={() => onQueryChange("")}
              aria-label="Clear search text"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={14} aria-hidden="true" />
            </button>
          ) : null}
        </div>

        {/* Filter Selects & Controls */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {/* Category Dropdown */}
          <div className="relative inline-flex items-center">
            <label htmlFor={categorySelectId} className="sr-only">
              Filter by category
            </label>
            <select
              id={categorySelectId}
              value={selectedCategory}
              onChange={(e) => onSelectCategory(e.target.value)}
              className="appearance-none rounded-full border border-white/15 bg-white/10 pl-3.5 pr-7 py-1.5 sm:py-2 min-h-[36px] font-display text-base sm:text-[11px] font-bold uppercase tracking-wider text-white/90 hover:bg-white/15 hover:text-white focus:border-white focus:outline-none focus:ring-1 focus:ring-white transition-colors cursor-pointer"
            >
              <option value="all" className="bg-[#121212] text-white">
                All Categories
              </option>
              {categories.map((cat) => (
                <option key={cat} value={cat} className="bg-[#121212] text-white">
                  {formatTvCategory(cat)}
                </option>
              ))}
            </select>
            <ChevronDown
              size={13}
              className="pointer-events-none absolute right-2.5 text-white/60"
              aria-hidden="true"
            />
          </div>

          {/* Year Dropdown */}
          <div className="relative inline-flex items-center">
            <label htmlFor={yearSelectId} className="sr-only">
              Filter by year
            </label>
            <select
              id={yearSelectId}
              value={selectedYear !== null ? String(selectedYear) : "all"}
              onChange={(e) => {
                const val = e.target.value;
                onSelectYear(val === "all" ? null : Number(val));
              }}
              className="appearance-none rounded-full border border-white/15 bg-white/10 pl-3.5 pr-7 py-1.5 sm:py-2 min-h-[36px] font-display text-base sm:text-[11px] font-bold uppercase tracking-wider text-white/90 hover:bg-white/15 hover:text-white focus:border-white focus:outline-none focus:ring-1 focus:ring-white transition-colors cursor-pointer"
            >
              <option value="all" className="bg-[#121212] text-white">
                All Years
              </option>
              {years.map((y) => (
                <option key={y} value={String(y)} className="bg-[#121212] text-white">
                  {y}
                </option>
              ))}
            </select>
            <ChevronDown
              size={13}
              className="pointer-events-none absolute right-2.5 text-white/60"
              aria-hidden="true"
            />
          </div>

          {/* Reset Filters CTA */}
          {isFiltered ? (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-3 py-1.5 sm:py-2 min-h-[36px] font-display text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-white hover:bg-white/25 active:scale-[0.98] transition-all"
              aria-label="Reset all search filters"
            >
              <RotateCcw size={12} aria-hidden="true" />
              <span>Reset</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
