export function EventSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading sport events"
      aria-busy="true"
      className="mx-auto flex w-full max-w-7xl flex-1 flex-col space-y-8 px-5 py-4 pb-10 sm:py-6 md:space-y-10 md:px-10"
    >
      {/* Header — mirrors SportEventsTab top circuit bar + StatusFilter command card */}
      <header aria-hidden="true" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-container border border-outline-variant bg-surface-container-lowest px-4 py-3 sm:px-5">
          <div className="h-4 w-36 animate-pulse rounded bg-surface-container-high" />
          <div className="flex items-center gap-2">
            <div className="h-control w-36 animate-pulse rounded-control bg-surface-container-high" />
            <div className="h-control w-28 animate-pulse rounded-control bg-surface-container-high" />
          </div>
        </div>

        <div className="rounded-container border border-outline-variant bg-surface-container-lowest p-4 sm:p-6">
          <div className="space-y-2.5 border-b border-outline-variant pb-4">
            <div className="h-3 w-40 animate-pulse rounded bg-surface-container-high" />
            <div className="h-8 w-56 animate-pulse rounded bg-surface-container-high" />
            <div className="h-4 w-full max-w-xl animate-pulse rounded bg-surface-container-high" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-card border border-outline-variant bg-surface-container"
              />
            ))}
          </div>
        </div>
      </header>

      {/* Featured — mirrors EventFeaturedHero section + hero card */}
      <section aria-hidden="true" className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-1.5">
            <div className="h-6 w-28 animate-pulse rounded bg-white/25" />
            <div className="h-3 w-20 animate-pulse rounded bg-white/20" />
          </div>
        </div>
        <div className="min-h-[38rem] w-full animate-pulse rounded-container border border-outline-variant bg-surface-container sm:h-[480px] sm:min-h-0 md:h-[560px]" />
      </section>

      {/* Grid — mirrors EventDirectory All Events grid */}
      <section aria-hidden="true" className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-1.5">
            <div className="h-6 w-32 animate-pulse rounded bg-white/25" />
            <div className="h-3 w-24 animate-pulse rounded bg-white/20" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col overflow-hidden rounded-container border border-outline-variant bg-surface-container-lowest"
            >
              <div className="h-52 w-full animate-pulse bg-surface-container" />
              <div className="space-y-3 p-5">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-20 animate-pulse rounded bg-surface-container-high" />
                  <div className="h-4 w-16 animate-pulse rounded bg-surface-container-high" />
                </div>
                <div className="h-5 w-3/4 animate-pulse rounded bg-surface-container-high" />
                <div className="space-y-1.5 pt-1">
                  <div className="h-3 w-full animate-pulse rounded bg-surface-container-high" />
                  <div className="h-3 w-5/6 animate-pulse rounded bg-surface-container-high" />
                </div>
                <div className="space-y-2 border-t border-outline-variant pt-3">
                  <div className="h-3 w-32 animate-pulse rounded bg-surface-container-high" />
                  <div className="h-3 w-40 animate-pulse rounded bg-surface-container-high" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
