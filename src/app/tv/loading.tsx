export default function TvLoading() {
  return (
    <div
      role="status"
      aria-label="Loading TV"
      aria-busy="true"
      className="min-h-dvh bg-black text-white"
    >
      <div className="mx-auto max-w-6xl px-0 py-6 md:py-8">
        <div className="min-w-0 space-y-2 sm:space-y-4 overflow-x-hidden px-3">
          <div className="min-w-0 space-y-4 overflow-x-hidden">
            {/* Header — mirrors TvGrid header */}
            <div
              aria-hidden="true"
              className="flex flex-wrap items-center justify-between gap-4 md:gap-6 lg:gap-8"
            >
              <div className="flex items-center gap-3 sm:gap-6">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 sm:h-12 sm:w-12 animate-pulse rounded bg-white/[0.06]" />
                  <div className="h-10 w-20 sm:h-12 sm:w-24 animate-pulse rounded bg-white/[0.06]" />
                </div>
                <div className="h-9 w-28 sm:w-36 animate-pulse rounded-full bg-white/[0.06]" />
              </div>

              {/* Discipline pills placeholder */}
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                <div className="h-8 w-14 animate-pulse rounded-full bg-white/[0.06]" />
                <div className="h-8 w-20 animate-pulse rounded-full bg-white/[0.06]" />
                <div className="h-8 w-24 animate-pulse rounded-full bg-white/[0.06]" />
                <div className="h-8 w-20 animate-pulse rounded-full bg-white/[0.06]" />
              </div>
            </div>

            {/* Category marquee rows shimmer — mirrors TvCategoryMarquee */}
            <div aria-hidden="true" className="space-y-4 pt-2">
              {[0, 1, 2].map((r) => (
                <section
                  key={r}
                  className="shrink-0 border-t border-wire-border bg-wire"
                >
                  <div className="flex items-center gap-1.5 bg-wire px-0 pt-[clamp(6px,1.2dvh,12px)]">
                    <span className="inline-flex h-[22px] w-28 animate-pulse rounded-full bg-white/[0.06]" />
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
          </div>
        </div>
      </div>
    </div>
  );
}
