import { Trophy } from "lucide-react";
import { BODY, CARD_TITLE, EMPTY_STATE } from "@/components/ui/recipes";
import type { SportEventStatusFilter } from "@/lib/schemas/event";

interface EventEmptyStateProps {
  status: SportEventStatusFilter;
}

export function EventEmptyState({ status }: EventEmptyStateProps) {
  const isFiltered = status !== "all";

  return (
    <div
      id="events-empty-state"
      className={`mx-auto flex max-w-lg flex-col items-center justify-center ${EMPTY_STATE} py-16`}
    >
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-control border border-outline-variant bg-surface-container-high text-secondary">
        <Trophy size={20} aria-hidden="true" />
      </div>
      <h4 className={`${CARD_TITLE} text-on-surface`}>
        {isFiltered ? "No matching events" : "No events on the horizon"}
      </h4>
      <p className={`mt-3 max-w-sm ${BODY}`}>
        {isFiltered
          ? "Try another status filter to see more of the circuit."
          : "The calendar is quiet for now. Check back as the next qualifier window opens."}
      </p>
    </div>
  );
}
