export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Loading league"
      aria-busy="true"
      className="flex min-h-0 flex-1 flex-col bg-surface font-sans text-on-surface"
    >
      {/* Main — warm hero gradient matching GameLanding */}
      <div className="flex flex-1 flex-col bg-gradient-primary px-5 py-4 sm:px-6 sm:py-6 lg:px-10">
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col">
          {/* Pills — JoinWithCode + Your record */}
          <div className="z-30 py-2" aria-hidden="true">
            <div className="mx-auto flex justify-center max-w-6xl gap-2">
              <div className="h-11 w-36 animate-pulse rounded-full bg-surface-container-lowest/95" />
              <div className="h-11 w-28 animate-pulse rounded-full bg-surface-container-lowest/80" />
            </div>
          </div>

          {/* LandingInfo card placeholder */}
          <div className="mt-4 space-y-4 sm:mt-8" aria-hidden="true">
            <div className="rounded-[16px] border border-outline-variant bg-surface-container-lowest p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="h-4 w-64 animate-pulse rounded bg-surface-container-high" />
                <div className="h-8 w-24 animate-pulse rounded-full bg-surface-container-high" />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-outline-variant pt-3">
                <div className="h-9 w-24 animate-pulse rounded-full bg-surface-container-high" />
                <div className="h-9 w-24 animate-pulse rounded-full bg-surface-container-high" />
              </div>
            </div>
          </div>

          {/* Title + form — mirrors GameLanding setup */}
          <section aria-hidden="true" className="mt-4">
            <div className="h-8 w-52 animate-pulse rounded bg-white/70" />

            <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start lg:gap-10">
              {/* Form steps column */}
              <div className="min-w-0 space-y-6">
                <div className="rounded-[16px] border border-outline-variant bg-surface-container-lowest p-4 sm:p-5 space-y-3">
                  <div className="h-3 w-20 animate-pulse rounded bg-surface-container-high" />
                  <div className="flex gap-2 pt-1">
                    <div className="h-9 w-24 animate-pulse rounded-full bg-surface-container-high" />
                    <div className="h-9 w-24 animate-pulse rounded-full bg-surface-container-high" />
                  </div>
                </div>

                <div className="rounded-[16px] border border-outline-variant bg-surface-container-lowest p-4 sm:p-5 space-y-3">
                  <div className="h-3 w-24 animate-pulse rounded bg-surface-container-high" />
                  <div className="flex gap-2 pt-1">
                    <div className="h-9 w-28 animate-pulse rounded-full bg-surface-container-high" />
                    <div className="h-9 w-28 animate-pulse rounded-full bg-surface-container-high" />
                  </div>
                </div>
              </div>

              {/* Desktop sidebar column — ConfigurationSummary */}
              <div className="min-w-0 hidden lg:block">
                <div className="space-y-4">
                  <div className="rounded-[16px] border border-outline-variant bg-surface-container-lowest p-4 sm:p-5 space-y-3">
                    <div className="h-4 w-32 animate-pulse rounded bg-surface-container-high" />
                    <div className="space-y-2 pt-2 border-t border-outline-variant">
                      <div className="h-3 w-full animate-pulse rounded bg-surface-container-high" />
                      <div className="h-3 w-4/5 animate-pulse rounded bg-surface-container-high" />
                      <div className="h-3 w-3/4 animate-pulse rounded bg-surface-container-high" />
                    </div>
                  </div>
                  <div className="h-12 w-full animate-pulse rounded-full bg-surface-container-lowest" />
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
