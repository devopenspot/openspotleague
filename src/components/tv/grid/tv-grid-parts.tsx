import { type RefObject } from "react";
import { Tv } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { chipClass, controlClass, PANEL_ON_WIRE } from "@/components/ui/recipes";

function pillClassName(active: boolean): string {
  return cn(chipClass(active, "wire"), "touch-manipulation");
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
    <div className="rounded-container border border-dashed border-wire-border-strong bg-tv-overlay px-5 py-10 text-center sm:px-6 sm:py-12">
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
    <div className={`${PANEL_ON_WIRE} px-5 py-8 text-center sm:px-6 sm:py-10`}>
      <p className="break-words text-sm font-semibold text-on-wire">
        No videos for this sport
      </p>
      <p className="mt-1 break-words text-xs text-wire-muted">
        Try another sport.
      </p>
      <button
        type="button"
        onClick={onShowAll}
        className={`mt-3 ${controlClass("onWire", "sm")}`}
      >
        Show all sports
      </button>
    </div>
  );
}
