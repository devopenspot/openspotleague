"use client";

import { useId } from "react";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatTvCategory } from "@/components/tv/marquee/tv-marquee-data";

export interface TvFilterBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  categories: readonly string[];
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  children?: React.ReactNode;
}

export function TvFilterBar({
  query,
  onQueryChange,
  categories,
  selectedCategory,
  onSelectCategory,
  children,
}: TvFilterBarProps) {
  const searchInputId = useId();
  const categorySelectId = useId();
  const hasCategory = selectedCategory !== "all";

  return (
    <div
      role="search"
      aria-label="Search and filter videos"
      className="flex items-center gap-2 py-1 sm:gap-2.5"
    >
      <div className="relative min-w-0 flex-1">
        <label htmlFor={searchInputId} className="sr-only">
          Search by rider, trick or event
        </label>
        <Search
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-wire-muted"
          aria-hidden="true"
        />
        <input
          id={searchInputId}
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search riders or tricks"
          autoComplete="off"
          spellCheck="false"
          className={cn(
            "min-h-[40px] w-full text-ellipsis rounded-full [&::-webkit-search-cancel-button]:appearance-none border border-wire-border-strong bg-tv-overlay py-1.5 pl-9 text-base font-medium text-on-wire transition-colors placeholder:text-wire-muted focus:border-on-wire focus:outline-none focus:ring-1 focus:ring-white sm:py-2 sm:text-sm",
            query ? "pr-9" : "pr-3",
          )}
        />
        {query ? (
          <button
            type="button"
            onClick={() => onQueryChange("")}
            aria-label="Clear search text"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-wire-muted transition-colors hover:bg-wire-border hover:text-on-wire"
          >
            <X size={14} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {/* Category: icon on phones (native select stretched over it), pill from sm */}
      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-wire-border-strong text-on-wire transition-colors hover:border-wire-muted focus-within:border-on-wire focus-within:ring-1 focus-within:ring-white sm:w-auto">
        <label htmlFor={categorySelectId} className="sr-only">
          Filter by category
        </label>
        <SlidersHorizontal size={16} className="sm:hidden" aria-hidden="true" />
        {hasCategory ? (
          <span
            aria-hidden="true"
            className="absolute right-2 top-2 h-2 w-2 rounded-full bg-on-wire sm:hidden"
          />
        ) : null}
        <select
          id={categorySelectId}
          value={selectedCategory}
          onChange={(e) => onSelectCategory(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-full bg-transparent text-base opacity-0 focus:outline-none sm:static sm:w-auto sm:pl-3.5 sm:pr-8 sm:font-display sm:text-[13px] sm:font-medium sm:opacity-100"
        >
          <option value="all" className="bg-wire text-on-wire">
            All categories
          </option>
          {categories.map((cat) => (
            <option key={cat} value={cat} className="bg-wire text-on-wire">
              {formatTvCategory(cat)}
            </option>
          ))}
        </select>
        <ChevronDown
          size={13}
          className="pointer-events-none absolute right-2.5 hidden text-wire-muted sm:block"
          aria-hidden="true"
        />
      </div>

      {children}
    </div>
  );
}
