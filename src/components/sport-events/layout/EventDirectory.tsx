import { EventCard } from "@/components/sport-events/cards/EventCard";
import { EventEmptyState } from "@/components/sport-events/shared/EventEmptyState";
import { EventFeaturedHero } from "@/components/sport-events/cards/EventFeaturedHero";
import { SECTION_TITLE, controlClass } from "@/components/ui/recipes";
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
          className="space-y-4"
        >
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2
                id="featured-event-heading"
                className={`${SECTION_TITLE} text-on-gradient`}
              >
                Featured
              </h2>
              <p className="mt-1 font-display text-xs font-semibold uppercase tracking-label text-white/80">
                Editor&apos;s pick
              </p>
            </div>
          </div>
          <EventFeaturedHero event={featured} />
        </section>
      )}

      <section
        id="events-grid-section"
        aria-labelledby="events-grid-heading"
        className="space-y-4"
      >
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2
              id="events-grid-heading"
              className={`${SECTION_TITLE} text-on-gradient`}
            >
              All Events
            </h2>
            <p className="mt-1 font-display text-xs font-semibold uppercase tracking-label text-white/80">
              {events.length} on the circuit
            </p>
          </div>
        </div>

        {events.length === 0 ? (
          <EventEmptyState status={status} />
        ) : (
          <div
            id="events-grid"
            className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {events.map((event, index) => (
              <EventCard key={event.id} event={event} priority={index === 0} />
            ))}
          </div>
        )}
      </section>

      <footer className="mt-auto border-t border-white/20 pt-8 pb-6 text-on-gradient sm:pt-10 sm:pb-8">
        <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
          <div>
            <p className="font-display text-xs font-bold tracking-label text-white/95 uppercase">
              All dates are subject to change. Tap a card to verify on the
              official site.
            </p>
            <p className="mt-1.5 text-xs text-white/75">
              Looking for a missing event? Check the official international
              federation calendar.
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
