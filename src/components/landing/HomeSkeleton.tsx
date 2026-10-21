export function HomeSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading home"
      aria-busy="true"
      className="flex h-full min-h-0 flex-col bg-surface"
    >
      {/* Hero — minimalist mirror of page.tsx h-3/5 wrapper + Hero grid */}
      <div
        aria-hidden="true"
        className="min-h-0 h-3/5 overflow-hidden overscroll-contain no-scrollbar"
      >
        <section className="relative flex h-full min-h-[340px] flex-col justify-center overflow-hidden bg-gradient-primary px-4 sm:px-6 md:px-8 lg:px-16 py-6">
          <div className="mx-auto flex h-full w-full max-w-4xl items-center justify-center">
            <div className="my-auto w-full min-w-0 space-y-4 text-center">
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
      </div>

      {/* Wire — minimalist mirror of LandingMarquee h-2/5 + h-[36vh] scroller */}
      <div
        aria-hidden="true"
        className="shrink-0 border-t border-wire-border bg-wire h-2/5"
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
