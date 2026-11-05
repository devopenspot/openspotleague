import Link from "next/link";
import { Trophy } from "lucide-react";
import {
  BODY,
  CARD_TITLE,
  EMPTY_STATE,
  controlClass,
} from "@/components/ui/recipes";
import type { SportEventStatusFilter } from "@/lib/schemas/event";

interface EventEmptyStateProps {
  status: SportEventStatusFilter;
}

const FILTERED_COPY: Record<Exclude<SportEventStatusFilter, "all">, string> = {
  live: "Nothing is live right now. Upcoming events show the next start date.",
  upcoming: "No upcoming events are scheduled yet.",
  completed: "No past events yet.",
};

export function EventEmptyState({ status }: EventEmptyStateProps) {
  const isFiltered = status !== "all";

  return (
    <div
      id="events-empty-state"
      className={`mx-auto flex w-full max-w-lg flex-col items-center justify-center ${EMPTY_STATE} text-on-surface`}
    >
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-control border border-outline-variant bg-surface-container-high text-secondary">
        <Trophy size={20} aria-hidden="true" />
      </div>
      <h3 className={CARD_TITLE}>
        {isFiltered ? "No matching events" : "No events on the horizon"}
      </h3>
      <p className={`mt-3 max-w-sm ${BODY}`}>
        {isFiltered
          ? FILTERED_COPY[status]
          : "The calendar is quiet for now. Check back as the next qualifier window opens."}
      </p>
      {isFiltered ? (
        <Link
          href="/sport-events"
          scroll={false}
          className={`mt-6 ${controlClass("outline", "sm")}`}
        >
          Show all events
        </Link>
      ) : null}
    </div>
  );
}
