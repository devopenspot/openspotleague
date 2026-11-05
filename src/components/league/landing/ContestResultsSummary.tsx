import { META_ON_GRADIENT } from "@/components/ui/recipes";

interface ContestResultsSummaryProps {
  visibleCount: number;
  totalCount: number;
}

/** The one visible count on the directory, announced when the filter changes. */
export function ContestResultsSummary({
  visibleCount,
  totalCount,
}: ContestResultsSummaryProps) {
  return (
    <p aria-live="polite" aria-atomic="true" className={META_ON_GRADIENT}>
      {visibleCount === totalCount
        ? `${totalCount} public ${totalCount === 1 ? "contest" : "contests"}`
        : `Showing ${visibleCount} of ${totalCount}`}
    </p>
  );
}
