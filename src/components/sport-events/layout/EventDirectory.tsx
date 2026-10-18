import { EventCard } from "@/components/sport-events/cards/EventCard";
import { EventEmptyState } from "@/components/sport-events/shared/EventEmptyState";
import { EventFeaturedHero } from "@/components/sport-events/cards/EventFeaturedHero";
import type {
  SportEventEnriched,
  SportEventStatus,
} from "@/types/sport-events";

interface EventDirectoryProps {
  featured: SportEventEnriched | undefined;
  events: readonly SportEventEnriched[];
  status: "all" | SportEventStatus;
}

export function EventDirectory({
  featured,
  events,
  status,
}: EventDirectoryProps) {
  return (
    <>
      {featured && (
        <section
          id="featured-event-section"
          aria-labelledby="featured-event-heading"
          className="space-y-5"
        >
          <div className="flex items-end justify-between gap-4 px-5 sm:px-6 lg:px-10">
            <div>
              <h2
                id="featured-event-heading"
                className="font-display text-xl font-bold tracking-wide text-on-surface uppercase"
              >
                Featured
              </h2>
              <p className="mt-1 font-display text-xs font-bold tracking-widest text-secondary uppercase">
                Editor&apos;s pick
              </p>
            </div>
          </div>
          <div className="mx-5 sm:mx-6 lg:mx-10">
            <EventFeaturedHero event={featured} />
          </div>
        </section>
      )}

      <section
        id="events-grid-section"
        aria-labelledby="events-grid-heading"
        className="space-y-5"
      >
        <div className="flex items-end justify-between gap-4 px-5 sm:px-6 lg:px-10">
          <div>
            <h2
              id="events-grid-heading"
              className="font-display text-xl font-bold tracking-wide text-on-surface uppercase"
            >
              All Events
            </h2>
            <p className="mt-1 font-display text-xs font-bold tracking-widest text-secondary uppercase">
              {events.length} on the circuit
            </p>
          </div>
        </div>

        {events.length === 0 ? (
          <EventEmptyState status={status} />
        ) : (
          <div
            id="events-grid"
            className="mx-5 grid grid-cols-1 gap-6 sm:mx-6 sm:grid-cols-2 lg:mx-10 lg:grid-cols-3"
          >
            {events.map((event, index) => (
              <EventCard key={event.id} event={event} priority={index === 0} />
            ))}
          </div>
        )}
      </section>

      <footer className="mx-5 border-t border-outline-variant pt-6 text-center sm:mx-6 lg:mx-10">
        <p className="font-display text-xs font-bold tracking-widest text-secondary uppercase">
          All dates are subject to change. Tap a card to verify on the official
          site.
        </p>
        <p className="mt-2 text-xs text-secondary">
          Looking for a missing event?{" "}
          <a
            href="https://www.worldskate.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-[9999px] px-2 py-1 font-display font-bold tracking-widest uppercase underline underline-offset-2 hover:text-on-surface focus-visible:outline-offset-4"
          >
            Browse the federations
          </a>
        </p>
      </footer>
    </>
  );
}
