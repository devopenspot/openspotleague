import { type RefObject } from "react";
import { Tv } from "lucide-react";
import { cn } from "@/lib/utils/cn";

function pillClassName(active: boolean): string {
  return cn(
    "flex min-h-[38px] shrink-0 items-center justify-center whitespace-nowrap rounded-full border px-3.5 py-1.5 font-display text-[13px] font-medium transition-colors touch-manipulation sm:min-h-[40px] sm:px-4 sm:py-2 sm:text-sm",
    active
      ? "border-on-wire bg-on-wire font-semibold text-black"
      : "border-wire-border-strong bg-transparent text-on-wire hover:border-wire-muted",
  );
}

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
      aria-label="Filter by sport"
      className="flex w-full gap-1 overflow-x-auto pb-1 no-scrollbar scroll-smooth"
    >
      {[{ slug: "all", name: "All" }, ...disciplines].map((d) => (
        <button
          key={d.slug}
          type="button"
          role="tab"
          data-slug={d.slug}
          aria-selected={selected === d.slug}
          tabIndex={selected === d.slug ? 0 : -1}
          onClick={() => onSelect(d.slug)}
          className={pillClassName(selected === d.slug)}
        >
          <span className="truncate">{d.name}</span>
        </button>
      ))}
    </div>
  );
}

export function TvGenericEmptyState() {
  return (
    <div className="rounded-[16px] border border-dashed border-wire-border-strong bg-tv-overlay px-0 py-10 text-center sm:px-6 sm:py-12">
      <Tv size={24} className="mx-auto text-wire-muted" aria-hidden="true" />
      <p className="mt-3 text-sm font-semibold text-on-wire">No videos yet</p>
      <p className="mt-1 break-words text-xs text-wire-muted">
        New videos land here soon.
      </p>
    </div>
  );
}

export function TvFilteredEmptyState({ onShowAll }: { onShowAll: () => void }) {
  return (
    <div className="rounded-[16px] border border-wire-border bg-tv-overlay px-4 py-8 text-center sm:px-6 sm:py-10">
      <p className="break-words text-sm font-semibold text-on-wire">
        No videos for this sport
      </p>
      <p className="mt-1 break-words text-xs text-wire-muted">
        Try another sport.
      </p>
      <button
        type="button"
        onClick={onShowAll}
        className="mt-3 rounded-full bg-on-wire px-4 py-1.5 font-display text-[13px] font-semibold text-black hover:bg-on-wire/90"
      >
        Show all sports
      </button>
    </div>
  );
}
