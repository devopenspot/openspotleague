"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Plus, Trophy } from "lucide-react";
import { EventDirectory } from "@/components/sport-events/layout/EventDirectory";
import { EventResultsSummary } from "@/components/sport-events/filters/EventResultsSummary";
import { StatusFilter } from "@/components/sport-events/filters/StatusFilter";
import { JoinByCodeEntry } from "@/components/league/JoinByCodeEntry";
import {
  EYEBROW_ON_GRADIENT,
  PAGE_TITLE,
  controlClass,
  pageContainer,
} from "@/components/ui/recipes";
import { useUser } from "@/lib/contexts/user-context";
import type { SportEventEnriched } from "@/types/sport-events";
import { useEventStatusFilter } from "@/lib/sport-events/status-filter";
import { orderEventsForDirectory } from "@/lib/sport-events/directory-order";

interface SportEventsTabProps {
  featured: SportEventEnriched | undefined;
  events: readonly SportEventEnriched[];
}

export function SportEventsTab({ featured, events }: SportEventsTabProps) {
  const { status, filter } = useEventStatusFilter();
  const user = useUser();

  const visibleEvents = useMemo(
    () => orderEventsForDirectory(filter(events)),
    [filter, events],
  );
  const featuredEvent = useMemo(() => {
    if (status === "completed") return undefined;
    if (featured && visibleEvents.some((event) => event.id === featured.id)) {
      return featured;
    }
    return visibleEvents.find((event) => event.status !== "completed");
  }, [featured, status, visibleEvents]);
  const listEvents = featuredEvent
    ? visibleEvents.filter((event) => event.id !== featuredEvent.id)
    : visibleEvents;

  return (
    <section
      id="sport-events-tab"
      aria-labelledby="sport-events-title"
      className={`${pageContainer("7xl", { padY: false })} flex flex-1 flex-col gap-10 py-8 animate-fade-in md:gap-12 md:py-10`}
    >
      <header className="flex flex-col gap-6">
        <div className="max-w-3xl">
          <p className={EYEBROW_ON_GRADIENT}>Official &amp; community circuit</p>
          <h1
            id="sport-events-title"
            className={`mt-2 ${PAGE_TITLE} text-on-gradient md:text-5xl`}
          >
            Sport Events
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-on-gradient/85">
            World tours, federations, festivals and community jams — the stages
            where action sports happen. Open an event for dates, location and
            your league results.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <JoinByCodeEntry variant="onWash" />
          <Link href="/league" className={controlClass("onWash")}>
            <Trophy size={14} aria-hidden="true" />
            My league
          </Link>
          {user ? (
            <Link href="/league/new" className={controlClass("onWashDark")}>
              <Plus size={14} aria-hidden="true" />
              Create event
            </Link>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 border-t border-on-gradient/20 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <StatusFilter events={events} />
          <EventResultsSummary
            visibleCount={visibleEvents.length}
            totalCount={events.length}
          />
        </div>
      </header>

      <EventDirectory
        featured={featuredEvent}
        events={listEvents}
        status={status}
      />
    </section>
  );
}
