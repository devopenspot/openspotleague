import { Trophy } from "lucide-react";
import type { SportEventStatusFilter } from "@/lib/schemas/event";

interface EventEmptyStateProps {
  status: SportEventStatusFilter;
}

export function EventEmptyState({ status }: EventEmptyStateProps) {
  const isFiltered = status !== "all";

  return (
    <div
      id="events-empty-state"
      className="mx-5 flex max-w-lg flex-col items-center justify-center rounded-[16px] border border-dashed border-outline-variant bg-surface-container-lowest px-5 py-16 text-center sm:mx-6 lg:mx-auto"
    >
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-[16px] border border-outline-variant bg-surface-container-high text-secondary">
        <Trophy size={20} aria-hidden="true" />
      </div>
      <h4 className="font-display text-xl font-bold uppercase tracking-wider text-on-surface">
        {isFiltered ? "No matching events" : "No events on the horizon"}
      </h4>
      <p className="mt-3 max-w-sm text-sm leading-6 text-secondary">
        {isFiltered
          ? "Try another status filter to see more of the circuit."
          : "The calendar is quiet for now. Check back as the next qualifier window opens."}
      </p>
    </div>
  );
}
