"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus, Trophy } from "lucide-react";
import { EventDirectory } from "@/components/sport-events/layout/EventDirectory";
import { EventResultsSummary } from "@/components/sport-events/filters/EventResultsSummary";
import { StatusFilter } from "@/components/sport-events/filters/StatusFilter";
import { JoinByCodeEntry } from "@/components/league/JoinByCodeEntry";
import { controlClass } from "@/components/ui/recipes";
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
      className="mx-auto flex w-full max-w-7xl flex-1 flex-col space-y-8 px-5 py-4 pb-10 animate-fade-in sm:py-6 md:space-y-10 md:px-10"
    >
      <h1 className="visually-hidden">Sport Events</h1>

      <header className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-container border border-outline-variant bg-surface-container-lowest px-4 py-3 text-on-surface sm:px-5">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="h-2 w-2 shrink-0 rounded-control bg-on-surface"
            />
            <EventResultsSummary
              visibleCount={visibleEvents.length}
              totalCount={events.length}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <JoinByCodeEntry />
            <Link href="/league" className={controlClass("secondary")}>
              <Trophy size={14} aria-hidden="true" />
              My league
            </Link>
            {user ? (
              <Link href="/league/new" className={controlClass("primary")}>
                <Plus size={14} aria-hidden="true" />
                Create event
              </Link>
            ) : null}
          </div>
        </div>

        <StatusFilter events={events} />

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
