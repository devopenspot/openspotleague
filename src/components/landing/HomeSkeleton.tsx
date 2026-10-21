export function HomeSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading home"
      aria-busy="true"
      className="flex min-h-full flex-col bg-surface"
    >
      {/* Hero skeleton */}
      <section className="relative flex w-full shrink-0 flex-col justify-center bg-gradient-primary px-4 sm:px-6 md:px-8 lg:px-16 pt-8 pb-10 sm:py-14 md:py-16">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center justify-center">
          <div className="w-full min-w-0 space-y-4 sm:space-y-5 text-center">
            {/* Discipline pills placeholder */}
            <div className="mx-auto h-6 w-64 animate-pulse rounded-full bg-white/20" />
            {/* Heading + subheadline placeholder */}
            <div className="space-y-2">
              <div className="mx-auto h-10 w-3/4 max-w-lg animate-pulse rounded-full bg-white/30" />
              <div className="mx-auto h-4 w-5/6 max-w-md animate-pulse rounded-full bg-white/20" />
            </div>
            {/* Search pill */}
            <div className="mx-auto h-[50px] w-full max-w-xl animate-pulse rounded-full bg-white/90" />
            {/* Pill buttons — mirrors Hero buttons */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <div className="h-9 w-28 animate-pulse rounded-full bg-white/20" />
              <div className="h-9 w-56 animate-pulse rounded-full bg-white/20" />
              <div className="h-9 w-28 animate-pulse rounded-full bg-white/20" />
              <div className="h-9 w-16 animate-pulse rounded-full bg-white/20" />
              <div className="h-9 w-20 animate-pulse rounded-full bg-white/20 md:hidden" />
              <div className="h-9 w-36 animate-pulse rounded-full bg-white/20" />
            </div>
          </div>
        </div>
      </section>

      {/* Metrics Bar skeleton */}
      <div className="shrink-0 border-b border-outline-variant/60 bg-surface-container-lowest py-8 px-4 sm:px-6 md:px-10">
        <div className="mx-auto max-w-7xl grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-surface-container-low animate-pulse" />
          ))}
        </div>
      </div>

      {/* Wire skeleton */}
      <div
        aria-hidden="true"
        className="shrink-0 border-t border-wire-border bg-wire"
      >
        <div className="bg-wire h-[36vh]">
          <div className="flex h-full items-center gap-2 overflow-hidden px-3 py-[clamp(6px,1.2dvh,12px)] sm:px-10">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-[32vh] w-[208px] shrink-0 animate-pulse rounded-[14px] border border-wire-border bg-wire-border sm:w-[232px]"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
