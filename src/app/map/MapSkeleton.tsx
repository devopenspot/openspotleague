import { BottomNavSkeleton } from "@/components/shell/BottomNavSkeleton";

export function MapSkeleton() {
  return (
    <div
      className="relative flex h-dvh flex-col bg-surface font-sans text-on-surface"
      role="status"
      aria-label="Loading map"
      aria-busy="true"
    >
      {/* Header — mirrors shell Header.tsx px-5 md:px-10 py-3.5 */}
      <header
        aria-hidden="true"
        className="sticky top-0 z-40 w-full border-b border-outline-variant bg-surface-container-lowest px-5 py-3.5 md:px-10"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-surface-container-high" />

          {/* Primary nav pills (desktop only) */}
          <div className="hidden items-center gap-2 md:flex">
            <div className="h-9 w-20 animate-pulse rounded-full bg-surface-container-high" />
            <div className="h-9 w-24 animate-pulse rounded-full bg-surface-container-high" />
            <div className="h-9 w-20 animate-pulse rounded-full bg-surface-container-high" />
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Search button */}
            <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-surface-container-high" />
            {/* Auth CTA pill (desktop) */}
            <div className="hidden h-10 w-24 animate-pulse rounded-full bg-surface-container-high md:inline-flex" />
            {/* Mobile drawer trigger */}
            <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-surface-container-high md:hidden" />
          </div>
        </div>
      </header>

      {/* Main — mirrors MapShell full-width canvas (no sidebar) */}
      <main className="relative flex min-h-0 flex-1 overflow-hidden pb-14 md:pb-0">
        <div
          aria-hidden="true"
          className="relative isolate flex min-h-0 flex-1 flex-col overflow-hidden bg-surface-container-low"
        >
          {/* Floating controls — mirrors MapControls top-2 left-3 */}
          <div className="pointer-events-none absolute left-3 right-3 top-2 z-10 flex max-w-full flex-wrap gap-2 sm:right-auto">
            <div className="h-10 w-24 animate-pulse rounded-full bg-surface-container-high" />
            <div className="h-10 w-28 animate-pulse rounded-full bg-surface-container-high" />
          </div>
          <div className="flex flex-1 items-center justify-center">
            <div className="h-8 w-32 animate-pulse rounded-full bg-surface-container-high/60" />
          </div>
        </div>
      </main>

      <BottomNavSkeleton />
    </div>
  );
}
