export function EventSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading sport events"
      aria-busy="true"
      className="mx-auto max-w-7xl space-y-12 pb-8 md:space-y-14"
    >
      {/* Header — mirrors SportEventsTab sticky header */}
      <header
        aria-hidden="true"
        className="sticky -top-42 z-40 w-full space-y-5 border-b border-outline-variant bg-surface-container-lowest px-5 pt-5 pb-5 sm:px-6 md:px-8"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            <div className="h-8 w-16  rounded-full bg-surface-container-high" />
            <div className="h-8 w-20  rounded-full bg-surface-container-high" />
            <div className="h-8 w-24  rounded-full bg-surface-container-high" />
            <div className="h-8 w-24  rounded-full bg-surface-container-high" />
          </div>
          <div className="h-11 w-28 shrink-0  rounded-full bg-surface-container-high" />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="h-4 w-36  rounded bg-surface-container-high" />
          <div className="h-11 w-44  rounded-full bg-surface-container-high" />
        </div>
      </header>

      {/* Featured — mirrors EventFeaturedHero section + hero card */}
      <section aria-hidden="true" className="space-y-5">
        <div className="flex items-end justify-between gap-4 px-5 sm:px-6 lg:px-10">
          <div className="space-y-1.5">
            <div className="h-5 w-24  rounded bg-surface-container-high" />
            <div className="h-3 w-20  rounded bg-surface-container-high" />
          </div>
        </div>
        <div className="mx-5 sm:mx-6 lg:mx-10">
          <div className="min-h-[38rem] w-full  rounded-[16px] border border-outline-variant bg-surface-container sm:h-[480px] sm:min-h-0 md:h-[560px]" />
        </div>
      </section>

      {/* Grid — mirrors EventDirectory All Events grid */}
      <section aria-hidden="true" className="space-y-5">
        <div className="flex items-end justify-between gap-4 px-5 sm:px-6 lg:px-10">
          <div className="space-y-1.5">
            <div className="h-5 w-28  rounded bg-surface-container-high" />
            <div className="h-3 w-24  rounded bg-surface-container-high" />
          </div>
        </div>

        <div className="mx-5 grid grid-cols-1 gap-6 sm:mx-6 sm:grid-cols-2 lg:mx-10 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col overflow-hidden rounded-[16px] border border-outline-variant bg-surface-container-lowest"
            >
              <div className="h-52 w-full  bg-surface-container" />
              <div className="space-y-3 p-5">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-20  rounded bg-surface-container-high" />
                  <div className="h-4 w-16  rounded bg-surface-container-high" />
                </div>
                <div className="h-5 w-3/4  rounded bg-surface-container-high" />
                <div className="space-y-1.5 pt-1">
                  <div className="h-3 w-full  rounded bg-surface-container-high" />
                  <div className="h-3 w-5/6  rounded bg-surface-container-high" />
                </div>
                <div className="space-y-2 border-t border-outline-variant pt-3">
                  <div className="h-3 w-32  rounded bg-surface-container-high" />
                  <div className="h-3 w-40  rounded bg-surface-container-high" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
