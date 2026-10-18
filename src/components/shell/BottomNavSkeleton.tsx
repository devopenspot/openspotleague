/**
 * BottomNavSkeleton — mirrors AppNavList variant="mobile-tab" + NavLink mobile-tab.
 * Keeps loading geometry identical to the real BottomNav to avoid CLS.
 * Visual-only: inert, no events, md:hidden so desktop/tablet is free.
 * Count matches bottom placements in nav.ts (explore, map, games, tv, profile=5).
 * Anonymous users see 4 but we render 5 to avoid pop-in for auth; justify-around absorbs 1 extra gracefully.
 * See AppNavList.tsx:22 VARIANT_CONTAINER["mobile-tab"] and NavLink.tsx:31 VARIANT_STYLES["mobile-tab"].
 */
export function BottomNavSkeleton({ count = 4 }: { count?: number }) {
  return (
    <nav
      aria-hidden="true"
      inert
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-outline-variant bg-surface px-2 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] md:hidden"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex min-h-14 flex-col items-center justify-center space-y-1 px-5"
        >
          <div className="h-[18px] w-[18px] animate-pulse rounded bg-surface-container-high" />
          <div className="h-2.5 w-9 animate-pulse rounded bg-surface-container-high" />
        </div>
      ))}
    </nav>
  );
}
