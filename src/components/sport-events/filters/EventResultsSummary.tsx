import { META_ON_GRADIENT } from "@/components/ui/recipes";

interface EventResultsSummaryProps {
  visibleCount: number;
  totalCount: number;
}

/** The one visible count on the directory, announced when the filter changes. */
export function EventResultsSummary({
  visibleCount,
  totalCount,
}: EventResultsSummaryProps) {
  return (
    <p aria-live="polite" aria-atomic="true" className={META_ON_GRADIENT}>
      {visibleCount === totalCount
        ? `${totalCount} ${totalCount === 1 ? "event" : "events"} on the circuit`
        : `Showing ${visibleCount} of ${totalCount}`}
    </p>
  );
}
