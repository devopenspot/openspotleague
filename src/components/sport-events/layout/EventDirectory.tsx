import type { ReactNode } from "react";
import { EventCard } from "@/components/sport-events/cards/EventCard";
import { EventEmptyState } from "@/components/sport-events/shared/EventEmptyState";
import { EventFeaturedHero } from "@/components/sport-events/cards/EventFeaturedHero";
import {
  EYEBROW_ON_GRADIENT,
  SECTION_TITLE,
  controlClass,
} from "@/components/ui/recipes";
import type { ContestEnriched, ContestStatus } from "@/types/league";

interface EventDirectoryProps {
  featured: ContestEnriched | undefined;
  /** Already filtered and ordered; excludes the featured event. */
  events: readonly ContestEnriched[];
  status: "all" | ContestStatus;
}

const UPCOMING_TITLE: Record<"all" | ContestStatus, string> = {
  all: "Live & upcoming",
  live: "Live now",
  upcoming: "Upcoming",
  completed: "Live & upcoming",
};

export function EventDirectory({
  featured,
  events,
  status,
}: EventDirectoryProps) {
  const active = events.filter((event) => event.status !== "completed");
  const past = events.filter((event) => event.status === "completed");
  const nothing = !featured && events.length === 0;

  return (
    <>
      {featured ? (
        <DirectorySection
          id="featured-event-section"
          title="Featured"
          eyebrow="Editor's pick"
        >
          <EventFeaturedHero event={featured} />
        </DirectorySection>
      ) : null}

      {nothing ? <EventEmptyState status={status} /> : null}

      {active.length > 0 ? (
        <DirectorySection
          id="events-grid-section"
          title={UPCOMING_TITLE[status]}
          eyebrow={`${active.length} ${active.length === 1 ? "event" : "events"}`}
        >
          <div
            id="events-grid"
            className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
          >
            {active.map((event, index) => (
              <EventCard key={event.id} event={event} priority={index === 0} />
            ))}
          </div>
        </DirectorySection>
      ) : null}

      {past.length > 0 ? (
        <DirectorySection
          id="past-events-section"
          title="Past events"
          eyebrow="Results and archives"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {past.map((event) => (
              <EventCard key={event.id} event={event} variant="compact" />
            ))}
          </div>
        </DirectorySection>
      ) : null}

      <footer className="mt-auto border-t border-on-gradient/20 pt-8 text-on-gradient">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="font-display text-xs font-bold uppercase tracking-label">
              Dates can change — confirm on the organizer&apos;s site.
            </p>
            <p className="mt-1.5 text-xs text-on-gradient/80">
              Missing an event? Check the international federation calendar.
            </p>
          </div>
          <a
            href="https://www.worldskate.org/"
            target="_blank"
            rel="noopener noreferrer"
            className={`${controlClass("onWash", "sm")} focus-visible:outline-white`}
          >
            Browse the federations
          </a>
        </div>
      </footer>
    </>
  );
}

function DirectorySection({
  id,
  title,
  eyebrow,
  children,
}: {
  id: string;
  title: string;
  eyebrow: string;
  children: ReactNode;
}) {
  const headingId = `${id}-heading`;
  return (
    <section id={id} aria-labelledby={headingId} className="space-y-4">
      <div>
        <p className={EYEBROW_ON_GRADIENT}>{eyebrow}</p>
        <h2
          id={headingId}
          className={`mt-1 ${SECTION_TITLE} text-on-gradient`}
        >
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}
