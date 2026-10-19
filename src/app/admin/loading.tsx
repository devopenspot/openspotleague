export default function AdminLoading() {
  return (
    <section
      aria-label="Loading administration"
      aria-busy="true"
      className="space-y-8"
    >
      {/* Header — mirrors AdminCurationHub header */}
      <div
        aria-hidden="true"
        className="flex flex-wrap items-end justify-between gap-5 border-b border-outline-variant pb-6"
      >
        <div className="space-y-2">
          <div className="h-3 w-32  rounded bg-surface-container-high" />
          <div className="h-9 w-72 max-w-full  rounded bg-surface-container-high" />
          <div className="h-4 w-96 max-w-full  rounded bg-surface-container-high" />
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="h-11 w-28  rounded-full bg-surface-container-high" />
          <div className="h-11 w-28  rounded-full bg-surface-container-high" />
        </div>
      </div>

      {/* Metrics — 4 cards matching AdminCurationHub dl */}
      <div aria-hidden="true" className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4 space-y-2"
          >
            <div className="h-3 w-16  rounded bg-surface-container-high" />
            <div className="h-8 w-14  rounded bg-surface-container-high" />
          </div>
        ))}
      </div>

      {/* Work areas — 4 panels matching AdminCurationHub */}
      <div aria-hidden="true" className="space-y-4">
        <div className="space-y-1">
          <div className="h-3 w-20  rounded bg-surface-container-high" />
          <div className="h-5 w-48  rounded bg-surface-container-high" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="h-40  rounded-lg border border-outline-variant bg-surface-container-low p-4 space-y-3"
            >
              <div className="h-4 w-20  rounded bg-surface-container-high" />
              <div className="h-3 w-full  rounded bg-surface-container-high" />
              <div className="h-3 w-3/4  rounded bg-surface-container-high" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
