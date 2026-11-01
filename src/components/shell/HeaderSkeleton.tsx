/**
 * HeaderSkeleton — mirrors Header.tsx (shell chrome).
 * Keeps geometry and dark bg-primary + wire tokens identical to avoid CLS.
 * Visual-only: inert, aria-hidden="true".
 */
export function HeaderSkeleton() {
  return (
    <header
      aria-hidden="true"
      className="sticky top-0 z-40 w-full border-b border-wire-border bg-primary px-5 py-3 md:px-10"
    >
      <div className="flex items-center justify-between gap-4">
        {/* Brand logo placeholder */}
        <div className="h-10 w-16 shrink-0 animate-pulse rounded-lg bg-wire-border" />

        {/* Primary discovery + play nav pills (desktop only) */}
        <div className="hidden items-center gap-2 md:flex">
          <div className="h-12 w-[136px] animate-pulse rounded-lg bg-wire-border" />
          <div className="h-12 w-[109px] animate-pulse rounded-lg bg-wire-border" />
          <div className="h-12 w-[68px] animate-pulse rounded-lg bg-wire-border" />
        </div>

        {/* Header action cluster */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Search button placeholder */}
          <div className="h-12 w-12 shrink-0 animate-pulse rounded-lg bg-wire-border" />
          {/* Inverted Auth CTA pill (desktop) */}
          <div className="hidden h-12 w-[91px] animate-pulse rounded-lg bg-on-wire/80 md:inline-flex" />
          {/* Mobile drawer trigger */}
          <div className="h-12 w-12 shrink-0 animate-pulse rounded-lg bg-wire-border" />
        </div>
      </div>
    </header>
  );
}
