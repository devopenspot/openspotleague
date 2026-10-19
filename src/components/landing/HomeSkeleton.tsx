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
        <section className="relative flex h-full min-h-[320px] flex-col justify-center overflow-hidden bg-gradient-to-r from-orange-600 via-red-600 to-red-700 px-5 md:px-8 lg:px-16 xl:px-20">
          <div className="mx-auto flex h-full w-full max-w-7xl items-center justify-center">
            <div className="my-auto w-full min-w-0 space-y-3">
              {/* Search pill */}
              <div className="h-[54px] w-full  rounded-full bg-white" />
              {/* Pill buttons — mirrors Hero buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="h-9 w-28  rounded-full bg-white/20" />
                <div className="h-9 w-56  rounded-full bg-white/20" />
                <div className="h-9 w-32  rounded-full bg-white/20" />
                <div className="h-9 w-16  rounded-full bg-white/20" />
                <div className="h-9 w-18  rounded-full bg-white/20 md:hidden" />
                <div className="h-9 w-36  rounded-full bg-white/20" />
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
                className="h-[32vh] w-[208px] shrink-0  rounded-[14px] border border-wire-border bg-wire-border sm:w-[232px]"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
