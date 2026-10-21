/**
 * Inline loading state for a discipline switch — the tapped pill
 * highlights instantly while the refetch flies, and this shimmer covers
 * the marquee stack until the fresh server rows land. Dark tokens mirror
 * `TvLoading` (`bg-white/[0.06]`).
 */
export function TvDisciplineSwitchingSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="shrink-0 space-y-2 sm:space-y-4">
      <span className="sr-only">{label}</span>
      {[0, 1].map((r) => (
        <section
          key={r}
          aria-hidden="true"
          className="shrink-0 border-t border-wire-border bg-wire"
        >
          <div className="flex items-center gap-1.5 bg-wire px-0 pt-[clamp(6px,1.2dvh,12px)]">
            <span className="inline-flex h-[22px] w-24 animate-pulse rounded-full bg-white/[0.06]" />
          </div>
          <div className="bg-wire py-2 sm:py-3">
            <div className="flex items-start gap-3 overflow-hidden bg-wire py-1">
              {[0, 1, 2, 3].map((c) => (
                <div
                  key={c}
                  className="flex w-[240px] sm:w-[270px] shrink-0 flex-col overflow-hidden rounded-[14px] border border-wire-border bg-wire"
                >
                  <div className="aspect-video w-full animate-pulse bg-white/[0.06]" />
                  <div className="flex flex-col gap-2 p-2.5 sm:p-3">
                    <div className="h-3.5 w-3/4 animate-pulse rounded bg-white/[0.06]" />
                    <div className="h-2.5 w-1/3 animate-pulse rounded bg-white/[0.06]" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
