/**
 * Inline loading state for a discipline switch — the tapped pill
 * highlights instantly while the refetch flies, and this shimmer covers
 * the marquee stack until the fresh server rows land. Dark tokens mirror
 * `TvLoading` (`bg-white/[0.06]` + ``).
 */
export function TvDisciplineSwitchingSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="shrink-0">
      <span className="sr-only">{label}</span>
      {[0, 1].map((r) => (
        <section
          key={r}
          aria-hidden="true"
          className="shrink-0 border-t border-wire-border bg-wire"
        >
          <div className="flex items-center gap-1.5 bg-wire px-0 pt-[clamp(6px,1.2dvh,12px)]">
            <span className="inline-flex h-[22px] w-24  rounded-full bg-white/[0.06]" />
          </div>
          <div className="bg-wire h-[36vh]">
            <div className="flex h-full items-center gap-2 overflow-hidden bg-wire py-[clamp(6px,1.2dvh,12px)]">
              {[0, 1, 2, 3].map((c) => (
                <div
                  key={c}
                  className="h-[32vh] w-[208px] shrink-0  rounded-[14px] bg-white/[0.06] sm:w-[232px]"
                />
              ))}
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
