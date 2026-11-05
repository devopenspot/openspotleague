import { META } from "@/components/ui/recipes";

interface EventResultsSummaryProps {
  visibleCount: number;
  totalCount: number;
}

export function EventResultsSummary({
  visibleCount,
  totalCount,
}: EventResultsSummaryProps) {
  return (
    <p
      aria-live="polite"
      aria-atomic="true"
      className={META}
    >
      {visibleCount === totalCount
        ? `${totalCount} on the circuit`
        : `Showing ${visibleCount} of ${totalCount}`}
    </p>
  );
}
