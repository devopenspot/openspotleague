import { AppImage } from "@/components/ui/AppImage";
import {
  MapPin,
  ExternalLink,
  Calendar,
  Instagram,
  Youtube,
  MapPinned,
} from "lucide-react";
import type {
  SportEventEnriched,
  SportEventStatus,
} from "@/types/sport-events";
import { cn } from "@/lib/utils/cn";
import { buildEventMapUrl } from "@/lib/sport-events/urls";

interface EventCardProps {
  event: SportEventEnriched;
  priority?: boolean;
}

const STATUS_DOT_STYLES: Record<SportEventStatus, string> = {
  live: "bg-error -dot",
  upcoming: "bg-on-surface",
  completed: "bg-outline",
};

const STATUS_TEXT_STYLES: Record<SportEventStatus, string> = {
  live: "text-error",
  upcoming: "text-on-surface",
  completed: "text-secondary",
};

function CategoryBadge({ categoryName }: { categoryName: string }) {
  return (
    <span
      aria-hidden="true"
      className="rounded-[8px] border border-outline bg-surface/95 px-2 py-1 font-display text-xs font-bold tracking-widest text-on-surface uppercase"
    >
      {categoryName}
    </span>
  );
}

const STATUS_LABEL: Record<SportEventStatus, string> = {
  live: "Live",
  upcoming: "Upcoming",
  completed: "Completed",
};

export function EventCard({ event, priority = false }: EventCardProps) {
  const { location } = event;
  const isCompleted = event.status === "completed";
  const statusLabel = STATUS_LABEL[event.status];
  const showStatus = event.status !== "upcoming";
  const hasSocials = Boolean(event.instagram || event.youtube);

  return (
    <article
      data-event-card={event.id}
      data-event-status={event.status}
      className="group relative flex w-full flex-col overflow-hidden rounded-[16px] border border-outline-variant bg-surface-container-lowest text-left transition-[border-color,background-color] hover:border-on-surface focus-within:border-on-surface"
    >
      <div className="relative h-52 w-full overflow-hidden bg-on-surface">
        {event.url ? (
          <a
            href={event.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${event.name} official site in a new tab`}
            className="absolute inset-0 z-0 block cursor-pointer"
          >
            <span className="visually-hidden">
              Open {event.name} official site
            </span>
            <AppImage
              src={event.image}
              alt={event.name}
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className={cn(
                "object-cover transition-transform duration-500 ease-out group-hover:scale-105 pointer-events-none",
                isCompleted && "opacity-60",
              )}
              referrerPolicy="no-referrer"
              unoptimized
              priority={priority}
            />
          </a>
        ) : (
          <AppImage
            src={event.image}
            alt={event.name}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className={cn(
              "object-cover transition-transform duration-500 ease-out group-hover:scale-105 pointer-events-none",
              isCompleted && "opacity-60",
            )}
            referrerPolicy="no-referrer"
            unoptimized
            priority={priority}
          />
        )}

        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-on-surface/70 via-on-surface/20 to-transparent"
          aria-hidden="true"
        />

        <div className="absolute top-3 left-3 z-10">
          <CategoryBadge categoryName={event.categoryName} />
        </div>

        {hasSocials && (
          <ul
            aria-label={`${event.name} social profiles`}
            className="absolute right-3 bottom-3 z-10 flex items-center gap-1.5"
          >
            {event.instagram && (
              <li>
                <a
                  href={event.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${event.name} on Instagram`}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-[9999px] bg-surface/95 text-on-surface transition-colors hover:bg-surface focus-visible:outline-offset-4"
                >
                  <Instagram size={12} aria-hidden="true" />
                </a>
              </li>
            )}
            {event.youtube && (
              <li>
                <a
                  href={event.youtube}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${event.name} on YouTube`}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-[9999px] bg-surface/95 text-on-surface transition-colors hover:bg-surface focus-visible:outline-offset-4"
                >
                  <Youtube size={12} aria-hidden="true" />
                </a>
              </li>
            )}
          </ul>
        )}

        {event.status === "live" && (
          <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 rounded-[8px] bg-surface/95 px-2 py-1 font-display text-xs font-bold tracking-widest text-error uppercase">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-error -dot"
            />
            Live
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="mb-2 flex items-center gap-2">
          <span
            aria-hidden="true"
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              STATUS_DOT_STYLES[event.status],
            )}
          />
          <span
            className={cn(
              "font-display text-xs font-bold tracking-widest uppercase",
              STATUS_TEXT_STYLES[event.status],
            )}
          >
            {showStatus ? statusLabel : event.dateRangeLabel}
          </span>
        </div>

        <h3 className="font-display text-lg font-bold tracking-wide text-on-surface uppercase group-hover:underline">
          {event.name}
        </h3>

        {event.shortName && (
          <span className="mt-1 block font-display text-xs tracking-widest text-secondary uppercase">
            {event.shortName}
          </span>
        )}

        <p className="mt-3 text-sm leading-relaxed text-secondary line-clamp-3">
          {event.description}
        </p>

        <dl className="mt-4 space-y-1.5 border-t border-outline-variant pt-3 text-xs">
          <div className="flex items-start gap-2 text-on-surface">
            <Calendar
              size={12}
              className="mt-0.5 shrink-0 text-secondary"
              aria-hidden="true"
            />
            <dt className="visually-hidden">Date</dt>
            <dd className="font-display tracking-wider font-semibold uppercase">
              {event.dateRangeLabel}
            </dd>
          </div>
          <div className="flex items-start gap-2 text-on-surface">
            <MapPin
              size={12}
              className="mt-0.5 shrink-0 text-secondary"
              aria-hidden="true"
            />
            <dt className="visually-hidden">Location</dt>
            <dd className="text-secondary">
              <span className="text-on-surface font-semibold">
                {location.city}
              </span>
              {location.country ? `, ${location.country}` : ""}
              {location.venue && (
                <span className="mt-0.5 block text-xs tracking-wider uppercase">
                  {location.venue}
                </span>
              )}
            </dd>
          </div>
        </dl>

        {event.sports.length > 0 && (
          <ul aria-label="Disciplines" className="mt-4 flex flex-wrap gap-1.5">
            {event.sports.map((sport) => (
              <li
                key={sport}
                className="rounded-[8px] border border-outline-variant bg-surface-container-low px-2 py-1 font-display text-xs font-bold tracking-widest text-on-surface uppercase"
              >
                {sport}
              </li>
            ))}
          </ul>
        )}

        {event.location.city && (
          <a
            href={buildEventMapUrl({
              location: {
                region: event.location.region,
                country: event.location.country,
              },
            })}
            aria-label={`Show spots and events in ${event.location.country} on the map`}
            className="mt-5 inline-flex min-h-11 items-center justify-between gap-2 rounded-[9999px] border border-outline-variant bg-surface-container-high px-4 py-2 font-display text-xs font-bold tracking-widest text-on-surface uppercase transition-colors hover:bg-surface-container-highest focus-visible:outline-offset-4"
          >
            <span>View spots and events in {event.location.country}</span>
            <MapPinned
              size={12}
              aria-hidden="true"
              className="transition-transform group-hover:translate-x-0.5"
            />
          </a>
        )}

        {hasSocials && (
          <ul
            aria-label={`${event.name} social profiles`}
            className="mt-3 flex items-center gap-2 border-t border-outline-variant pt-3"
          >
            {event.instagram && (
              <li>
                <a
                  href={event.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${event.name} on Instagram`}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-[9999px] px-2 font-display text-xs font-bold tracking-widest text-on-surface uppercase hover:underline focus-visible:outline-offset-4"
                >
                  <Instagram size={11} aria-hidden="true" />
                  Instagram
                </a>
              </li>
            )}
            {event.instagram && event.youtube && (
              <li aria-hidden="true" className="h-3 w-px bg-outline-variant" />
            )}
            {event.youtube && (
              <li>
                <a
                  href={event.youtube}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${event.name} on YouTube`}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-[9999px] px-2 font-display text-xs font-bold tracking-widest text-on-surface uppercase hover:underline focus-visible:outline-offset-4"
                >
                  <Youtube size={11} aria-hidden="true" />
                  YouTube
                </a>
              </li>
            )}
          </ul>
        )}

        {event.url ? (
          <a
            href={event.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Visit ${event.name} official site in a new tab`}
            className="mt-5 inline-flex min-h-11 items-center justify-between gap-2 rounded-[9999px] bg-primary px-4 py-3 font-display text-xs font-bold tracking-widest text-on-primary uppercase transition-[background-color,transform] hover:bg-primary/90 focus-visible:outline-offset-4 active:translate-y-px"
          >
            <span>Visit official site</span>
            <ExternalLink
              size={12}
              aria-hidden="true"
              className="transition-transform group-hover:translate-x-0.5"
            />
          </a>
        ) : null}
      </div>
    </article>
  );
}
