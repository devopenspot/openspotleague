"use client";

import { useId } from "react";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { INPUT_ON_WIRE } from "@/components/ui/recipes";
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
          Search by rider, event
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
          placeholder="Type your search..."
          autoComplete="off"
          spellCheck="false"
          className={cn(
            `${INPUT_ON_WIRE} text-ellipsis pl-9 [&::-webkit-search-cancel-button]:appearance-none`,
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
      <div className="relative flex h-control w-control shrink-0 items-center justify-center rounded-control border border-wire-border-strong bg-wire-border text-on-wire transition-colors hover:border-wire-muted focus-within:border-on-wire focus-within:ring-1 focus-within:ring-white sm:w-auto">
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
          className="absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-full bg-transparent text-base opacity-0 focus:outline-none sm:static sm:w-auto sm:pl-4 sm:pr-8 sm:font-display sm:text-xs sm:font-bold sm:uppercase sm:tracking-pill sm:opacity-100"
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
