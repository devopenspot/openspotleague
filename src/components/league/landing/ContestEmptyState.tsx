import Link from "next/link";
import { Trophy } from "lucide-react";
import {
  BODY,
  CARD_TITLE,
  EMPTY_STATE,
  controlClass,
} from "@/components/ui/recipes";
import type { SportEventStatusFilter } from "@/lib/schemas/event";
import { ROUTES } from "@/lib/navigation/nav";

interface ContestEmptyStateProps {
  status: SportEventStatusFilter;
}

const FILTERED_COPY: Record<Exclude<SportEventStatusFilter, "all">, string> = {
  live: "No public contest is live right now.",
  upcoming: "No upcoming public contests yet.",
  completed: "No past public contests yet.",
};

export function ContestEmptyState({ status }: ContestEmptyStateProps) {
  const isFiltered = status !== "all";

  return (
    <div
      id="contests-empty-state"
      className={`mx-auto flex w-full max-w-lg flex-col items-center justify-center ${EMPTY_STATE} text-on-surface`}
    >
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-control border border-outline-variant bg-surface-container-high text-secondary">
        <Trophy size={20} aria-hidden="true" />
      </div>
      <h3 className={CARD_TITLE}>
        {isFiltered ? "No matching contests" : "No public contests yet"}
      </h3>
      <p className={`mt-3 max-w-sm ${BODY}`}>
        {isFiltered
          ? FILTERED_COPY[status]
          : "Public listings arrive with the paid tiers. Free contests stay private and are shared with riders by QR code or invite link."}
      </p>
      {isFiltered ? (
        <Link
          href={ROUTES.league}
          scroll={false}
          className={`mt-6 ${controlClass("outline", "sm")}`}
        >
          Show all contests
        </Link>
      ) : null}
    </div>
  );
}
