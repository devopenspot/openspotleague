/**
 * Loading mirror of LeagueLanding: on-wash header (eyebrow, title, copy,
 * actions, segmented filter), featured hero, and the card grid. Blocks on the
 * blue wash use bg-white/* (DESIGN.md components.skeleton.on-gradient-or-wire).
 */
export function ContestSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading contests"
      aria-busy="true"
      className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-10 px-5 py-8 md:gap-12 md:px-10 md:py-10"
    >
      <header aria-hidden="true" className="flex flex-col gap-6">
        <div className="max-w-3xl space-y-3">
          <div className="h-3 w-48 animate-pulse rounded-control bg-white/20" />
          <div className="h-9 w-64 animate-pulse rounded-card bg-white/25 md:h-12 md:w-80" />
          <div className="h-4 w-full max-w-xl animate-pulse rounded-control bg-white/15" />
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="h-control w-40 animate-pulse rounded-control bg-white/25" />
          <div className="h-control w-32 animate-pulse rounded-control bg-white/25" />
        </div>
        <div className="flex flex-col gap-3 border-t border-white/20 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="h-11 w-full animate-pulse rounded-control bg-white/25 sm:w-96" />
          <div className="h-3 w-36 animate-pulse rounded-control bg-white/20" />
        </div>
      </header>

      <section aria-hidden="true" className="space-y-4">
        <div className="space-y-2">
          <div className="h-3 w-24 animate-pulse rounded-control bg-white/20" />
          <div className="h-7 w-36 animate-pulse rounded-card bg-white/25" />
        </div>
        <div className="h-[28rem] w-full animate-pulse rounded-container bg-white/15 sm:h-[480px] md:h-[520px]" />
      </section>

      <section aria-hidden="true" className="space-y-4">
        <div className="space-y-2">
          <div className="h-3 w-20 animate-pulse rounded-control bg-white/20" />
          <div className="h-7 w-48 animate-pulse rounded-card bg-white/25" />
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col overflow-hidden rounded-container border border-outline-variant bg-surface-container-lowest"
            >
              <div className="h-48 w-full animate-pulse bg-surface-container sm:h-52" />
              <div className="space-y-3 p-5">
                <div className="h-3 w-20 animate-pulse rounded-control bg-surface-container-high" />
                <div className="h-5 w-3/4 animate-pulse rounded-card bg-surface-container-high" />
                <div className="h-3 w-full animate-pulse rounded-control bg-surface-container-high" />
                <div className="space-y-2 border-t border-outline-variant pt-3">
                  <div className="h-3 w-32 animate-pulse rounded-control bg-surface-container-high" />
                  <div className="h-3 w-40 animate-pulse rounded-control bg-surface-container-high" />
                </div>
                <div className="flex items-center justify-between pt-2">
                  <div className="h-3 w-24 animate-pulse rounded-control bg-surface-container-high" />
                  <div className="h-control w-control animate-pulse rounded-control bg-surface-container-high" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/** Loading rows for the signed-in "My contests" section (on the wash). */
export function MyContestsSkeleton() {
  return (
    <div aria-busy="true">
      <p className="sr-only">Loading your contests…</p>
      <div className="flex flex-col gap-3" aria-hidden="true">
        {[0, 1].map((index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-container bg-white/20"
          />
        ))}
      </div>
    </div>
  );
}
