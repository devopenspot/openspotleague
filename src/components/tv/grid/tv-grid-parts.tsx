import { type RefObject } from "react";
import { Tv } from "lucide-react";

export function TvDisciplinePills({
  listRef,
  disciplines,
  selected,
  onSelect,
}: {
  listRef: RefObject<HTMLDivElement | null>;
  disciplines: readonly { slug: string; name: string }[];
  selected: string;
  onSelect: (slug: string) => void;
}) {
  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label="Filter by discipline"
      className="flex w-full gap-1 sm:gap-1.5 overflow-x-auto pb-1 no-scrollbar scroll-smooth"
    >
      <button
        type="button"
        role="tab"
        data-slug="all"
        aria-selected={selected === "all"}
        onClick={() => onSelect("all")}
        className={`shrink-0 whitespace-nowrap rounded-full border px-2.5 sm:px-3.5 py-1 sm:py-1.5 font-display text-[10px] sm:text-[11px] font-bold uppercase tracking-wide sm:tracking-widest transition-colors ${
          selected === "all"
            ? "border-white bg-white text-black"
            : "border-white/15 bg-white/10 text-white/80 hover:bg-white/15 hover:text-white"
        }`}
      >
        <span className="truncate">All</span>
      </button>
      {disciplines.map((d) => (
        <button
          key={d.slug}
          type="button"
          role="tab"
          data-slug={d.slug}
          aria-selected={selected === d.slug}
          onClick={() => onSelect(d.slug)}
          className={`shrink-0 whitespace-nowrap rounded-full border px-2.5 sm:px-3.5 py-1 sm:py-1.5 font-display text-[10px] sm:text-[11px] font-bold uppercase tracking-wide sm:tracking-widest transition-colors ${
            selected === d.slug
              ? "border-white bg-white text-black"
              : "border-white/15 bg-white/10 text-white/80 hover:bg-white/15 hover:text-white"
          }`}
        >
          <span className="truncate">{d.name}</span>
        </button>
      ))}
    </div>
  );
}

export function TvGenericEmptyState() {
  return (
    <div className="rounded-[16px] border border-dashed border-white/15 bg-white/[0.04] px-0 py-10 sm:px-6 sm:py-12 text-center">
      <Tv size={24} className="mx-auto text-white/30" aria-hidden="true" />
      <p className="mt-3 text-sm font-semibold text-white">No videos yet</p>
      <p className="mt-1 text-xs text-white/60 break-words">
        Curators will publish sessions here. Check back soon.
      </p>
    </div>
  );
}

export function TvFilteredEmptyState({
  onClearFilters,
}: {
  onClearFilters: () => void;
}) {
  return (
    <div className="rounded-[16px] border border-white/10 bg-white/[0.04] px-4 py-8 sm:px-6 sm:py-10 text-center">
      <p className="text-sm font-semibold text-white break-words">
        No sessions for this filter
      </p>
      <p className="mt-1 text-xs text-white/60 break-words">
        Try another discipline — your queue is empty.
      </p>
      <button
        type="button"
        onClick={onClearFilters}
        className="mt-3 rounded-full bg-white px-4 py-1.5 font-display text-[10px] sm:text-[11px] font-bold uppercase tracking-wide sm:tracking-widest text-black hover:bg-white/90"
      >
        Clear filters
      </button>
    </div>
  );
}
