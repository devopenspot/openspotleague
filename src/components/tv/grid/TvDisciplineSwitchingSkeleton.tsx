import { TvRowSkeleton } from "./TvCatalogSkeleton";

/**
 * Inline loading state for a discipline switch — the tapped pill
 * highlights instantly while the refetch flies, and these rows cover
 * the marquee stack until the fresh server rows land.
 */
export function TvDisciplineSwitchingSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="shrink-0 space-y-2 sm:space-y-4">
      <span className="sr-only">{label}</span>
      {[0, 1].map((r) => (
        <TvRowSkeleton key={r} />
      ))}
    </div>
  );
}
