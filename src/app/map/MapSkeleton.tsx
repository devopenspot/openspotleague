export function MapSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading map"
      aria-busy="true"
      className="relative isolate flex min-h-0 flex-1 flex-col overflow-hidden bg-map-surface h-full"
    >
      {/* Floating controls — mirrors MapControls left-1/5 md:left-3 top-2 */}
      <div className="pointer-events-none absolute left-1/5 md:left-3 right-3 top-2 z-10 flex max-w-full flex-wrap gap-2 sm:right-auto">
        <div className="h-12 w-64 animate-pulse rounded-lg border-2 border-map-outline-variant/30 bg-map-surface-container" />
      </div>
      <div className="flex flex-1 items-center justify-center">
        <div className="h-8 w-32 animate-pulse rounded-full bg-map-surface-container/60" />
      </div>
    </div>
  );
}
