import { HERO_DESCRIPTION, HERO_TITLE } from "./hero.messages";

export function HomeSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading home"
      aria-busy="true"
      className="flex min-h-full flex-col bg-surface"
    >
      {/* Hero skeleton */}
      <section className="relative flex w-full shrink-0 flex-col justify-center bg-gradient-primary px-5 sm:px-6 lg:px-10 py-6 sm:py-10 md:py-12">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center justify-center">
          <div className="w-full min-w-0 space-y-4 sm:space-y-5 text-center">
            {/* Discipline pills placeholder */}
            <div className="mx-auto h-[29px] sm:h-[30px] w-64 animate-pulse rounded-lg bg-white/20" />
            {/* Heading + subheadline placeholder — transparent real copy, so it wraps exactly like Hero */}
            <div aria-hidden="true" className="space-y-1 sm:space-y-2">
              <div className="animate-pulse font-display text-2xl sm:text-4xl md:text-5xl font-bold uppercase tracking-[-0.02em] text-transparent leading-[1.3] sm:leading-[1.15]">
                <span className="rounded-lg bg-white/30 box-decoration-clone">
                  {HERO_TITLE}
                </span>
              </div>
              <p className="mx-auto max-w-xl animate-pulse text-sm md:text-base font-semibold text-transparent leading-5 md:leading-6">
                <span className="rounded-lg bg-white/20 box-decoration-clone">
                  {HERO_DESCRIPTION}
                </span>
              </p>
            </div>
            {/* Search pill */}
            <div className="pt-1">
              <div className="mx-auto h-12 w-full max-w-xl animate-pulse rounded-lg bg-white/90" />
            </div>
            {/* Action buttons — mirrors Hero buttons */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <div className="h-12 w-[118px] animate-pulse rounded-lg bg-white/20" />
              <div className="h-12 w-[76px] animate-pulse rounded-lg bg-white/20" />
              <div className="h-12 w-[317px] max-w-full animate-pulse rounded-lg bg-white/20" />
              <div className="h-12 w-[98px] animate-pulse rounded-lg bg-white/20 md:hidden" />
              <div className="h-12 w-[181px] animate-pulse rounded-lg bg-white/20" />
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
