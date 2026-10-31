import { cn } from "@/lib/utils/cn";

/**
 * The single TV skeleton system. Geometry mirrors `TvMarqueeCard` and
 * `TvCategoryMarquee` so nothing jumps when data lands; blocks use
 * `bg-wire-border`, the same fill as a thumbnail that hasn't loaded yet.
 */
const BLOCK = "animate-pulse bg-wire-border";

function TextLine({
  height,
  width,
}: {
  /** Line box height of the real text, so stacked lines keep its rhythm. */
  height: string;
  width: string;
}) {
  return (
    <div className={cn("flex items-center", height)}>
      <div className={cn("h-3 rounded", BLOCK, width)} />
    </div>
  );
}

export function TvCardSkeleton({ fluid = false }: { fluid?: boolean }) {
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col gap-2",
        fluid ? "w-full" : "w-[240px] sm:w-[270px]",
      )}
    >
      <div className={cn("aspect-video w-full rounded-md", BLOCK)} />
      {/* Two title lines: nearly every row has one, so row height holds. */}
      <div className="flex flex-col gap-0.5 px-0.5">
        <div>
          <TextLine height="h-[18px] sm:h-[19px]" width="w-11/12" />
          <TextLine height="h-[18px] sm:h-[19px]" width="w-2/3" />
        </div>
        <TextLine height="h-4" width="w-1/3" />
      </div>
    </div>
  );
}

export function TvRowSkeleton() {
  return (
    <section aria-hidden="true" className="shrink-0 pt-3 sm:pt-4">
      <TextLine height="h-5 sm:h-[23px]" width="w-32" />
      <div className="py-2 sm:py-3">
        <div className="flex items-start gap-3 overflow-hidden py-1">
          {[0, 1, 2, 3].map((c) => (
            <TvCardSkeleton key={c} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function TvQueueItemSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading more videos…"
      className="w-auto min-w-52 max-w-60 shrink-0 snap-start overflow-hidden rounded-[10px] border border-wire-border landscape:w-20"
    >
      <span className={cn("block aspect-video w-full", BLOCK)} />
      <span className="block px-1.5 py-1 landscape:hidden">
        <span className={cn("block h-2.5 w-16 rounded", BLOCK)} />
      </span>
    </div>
  );
}

const PILL_WIDTHS = ["w-12", "w-28", "w-16", "w-20", "w-20"];

/** Mirrors the sport pills and the search line above the rows. */
export function TvControlsSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-2 sm:space-y-4">
      <div className="flex gap-1 overflow-hidden pb-1">
        {PILL_WIDTHS.map((width, i) => (
          <div
            key={i}
            className={cn(
              "h-[38px] shrink-0 rounded-full sm:h-10",
              BLOCK,
              width,
            )}
          />
        ))}
      </div>
      <div className="flex items-center gap-2 py-1 sm:gap-2.5">
        <div className={cn("h-10 min-w-0 flex-1 rounded-full", BLOCK)} />
        <div className={cn("h-10 w-10 shrink-0 rounded-full sm:w-40", BLOCK)} />
        <div className={cn("h-10 w-10 shrink-0 rounded-full sm:w-28", BLOCK)} />
      </div>
    </div>
  );
}

/** Whole-catalog placeholder: same outer spacing as `TvGrid`. */
export function TvCatalogSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading TV"
      aria-busy="true"
      className="mb-30 mt-6 min-w-0 space-y-2 overflow-x-hidden px-3 sm:space-y-4"
    >
      <TvControlsSkeleton />
      <div className="space-y-2 sm:space-y-4">
        {[0, 1, 2].map((r) => (
          <TvRowSkeleton key={r} />
        ))}
      </div>
    </div>
  );
}
