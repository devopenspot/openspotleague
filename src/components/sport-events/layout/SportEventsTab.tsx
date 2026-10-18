"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus, Trophy } from "lucide-react";
import { EventDirectory } from "@/components/sport-events/layout/EventDirectory";
import { EventResultsSummary } from "@/components/sport-events/filters/EventResultsSummary";
import { StatusFilter } from "@/components/sport-events/filters/StatusFilter";
import { JoinByCodeEntry } from "@/components/league/JoinByCodeEntry";
import { useUser } from "@/lib/contexts/user-context";
import type { SportEventEnriched } from "@/types/sport-events";
import { useEventStatusFilter } from "@/lib/sport-events/status-filter";
import { orderEventsForDirectory } from "@/lib/sport-events/directory-order";

interface SportEventsTabProps {
  featured: SportEventEnriched | undefined;
  events: readonly SportEventEnriched[];
}

export function SportEventsTab({ featured, events }: SportEventsTabProps) {
  const searchParams = useSearchParams();
  const { status, filter } = useEventStatusFilter();
  const user = useUser();

  const visibleEvents = useMemo(
    () => orderEventsForDirectory(filter(events)),
    [filter, events],
  );
  const featuredEventForGrid = useMemo(() => {
    if (featured && visibleEvents.some((event) => event.id === featured.id)) {
      return featured;
    }
    return visibleEvents.find((event) => event.status !== "completed");
  }, [featured, visibleEvents]);
  const gridList = featuredEventForGrid
    ? visibleEvents.filter((event) => event.id !== featuredEventForGrid.id)
    : visibleEvents;

  return (
    <section
      id="sport-events-tab"
      role="tabpanel"
      aria-labelledby="nav-btn-events"
      className="mx-auto max-w-7xl space-y-12 pb-8 animate-fade-in md:space-y-14"
    >
      <h1 className="visually-hidden">Sport Events</h1>

      <header className="sticky -top-42 z-40 w-full space-y-5 border-b border-outline-variant bg-surface-container-lowest px-5 pt-5 sm:px-6 md:px-8">
        <div className="flex items-center justify-between gap-3">
          <StatusFilter events={events} />
          <div className="flex shrink-0 flex-col items-stretch gap-2">
            {user ? (
              <Link
                href="/league/new"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-4 font-display text-xs font-semibold uppercase tracking-[0.08em] text-on-primary transition-opacity hover:opacity-90"
              >
                <Plus size={14} aria-hidden="true" />
                Create event
              </Link>
            ) : null}
            <Link
              href="/league"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-outline-variant bg-surface-container-high px-4 font-display text-xs font-semibold uppercase tracking-[0.08em] text-on-surface transition-colors hover:border-outline"
            >
              <Trophy size={14} aria-hidden="true" />
              My league
            </Link>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <EventResultsSummary
            visibleCount={visibleEvents.length}
            totalCount={events.length}
          />
          <JoinByCodeEntry />
        </div>
        <span className="sr-only">
          {searchParams.get("status")
            ? `Showing ${status} events`
            : "Showing all events"}
        </span>
      </header>

      <EventDirectory
        featured={featuredEventForGrid}
        events={gridList}
        status={status}
      />
    </section>
  );
}
