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
      className="font-display text-xs font-bold tracking-widest text-secondary uppercase"
    >
      {visibleCount === totalCount
        ? `${totalCount} on the circuit`
        : `Showing ${visibleCount} of ${totalCount}`}
    </p>
  );
}
