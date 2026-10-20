import { HeaderSkeleton } from "@/components/shell/HeaderSkeleton";
import { BottomNavSkeleton } from "@/components/shell/BottomNavSkeleton";

export function MapSkeleton() {
  return (
    <div
      className="relative flex h-dvh flex-col bg-surface font-sans text-on-surface"
      role="status"
      aria-label="Loading map"
      aria-busy="true"
    >
      <HeaderSkeleton />

      {/* Main — mirrors MapShell full-width canvas (no sidebar) */}
      <main className="relative flex min-h-0 flex-1 overflow-hidden pb-14 md:pb-0">
        <div
          aria-hidden="true"
          className="relative isolate flex min-h-0 flex-1 flex-col overflow-hidden bg-map-surface"
        >
          {/* Floating controls — mirrors MapControls top-2 left-3 */}
          <div className="pointer-events-none absolute left-3 right-3 top-2 z-10 flex max-w-full flex-wrap gap-2 sm:right-auto">
            <div className="h-11 w-28 animate-pulse rounded-full border border-map-outline-variant/30 bg-map-surface-container" />
            <div className="h-11 w-32 animate-pulse rounded-full border border-map-outline-variant/30 bg-map-surface-container" />
          </div>
          <div className="flex flex-1 items-center justify-center">
            <div className="h-8 w-32 animate-pulse rounded-full bg-map-surface-container/60" />
          </div>
        </div>
      </main>

      <BottomNavSkeleton />
    </div>
  );
}
