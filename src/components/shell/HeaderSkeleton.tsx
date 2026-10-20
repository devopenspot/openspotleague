/**
 * HeaderSkeleton — mirrors Header.tsx (shell chrome).
 * Keeps geometry and dark bg-primary + wire tokens identical to avoid CLS.
 * Visual-only: inert, aria-hidden="true".
 */
export function HeaderSkeleton() {
  return (
    <header
      aria-hidden="true"
      className="sticky top-0 z-40 w-full border-b border-wire-border bg-primary px-5 py-3.5 md:px-10"
    >
      <div className="flex items-center justify-between gap-4">
        {/* Brand logo placeholder */}
        <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-wire-border" />

        {/* Primary discovery + play nav pills (desktop only) */}
        <div className="hidden items-center gap-2 md:flex">
          <div className="h-11 w-20 animate-pulse rounded-[16px] bg-wire-border" />
          <div className="h-11 w-24 animate-pulse rounded-[16px] bg-wire-border" />
          <div className="h-11 w-24 animate-pulse rounded-[16px] bg-wire-border" />
          <div className="h-11 w-20 animate-pulse rounded-[16px] bg-wire-border" />
        </div>

        {/* Header action cluster */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Search button placeholder */}
          <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-wire-border" />
          {/* Inverted Auth CTA pill (desktop) */}
          <div className="hidden h-10 w-24 animate-pulse rounded-full bg-on-wire/80 md:inline-flex" />
          {/* Mobile drawer trigger */}
          <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-wire-border md:hidden" />
        </div>
      </div>
    </header>
  );
}
