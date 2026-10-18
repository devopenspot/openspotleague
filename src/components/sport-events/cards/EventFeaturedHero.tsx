import { AppImage } from "@/components/ui/AppImage";
import {
  MapPin,
  Calendar,
  ExternalLink,
  Trophy,
  Instagram,
  Youtube,
  MapPinned,
} from "lucide-react";
import type { SportEventEnriched } from "@/types/sport-events";
import { cn } from "@/lib/utils/cn";
import { buildEventMapUrl } from "@/lib/sport-events/urls";

interface EventFeaturedHeroProps {
  event: SportEventEnriched;
}

export function EventFeaturedHero({ event }: EventFeaturedHeroProps) {
  const { location } = event;
  const isLive = event.status === "live";
  const isCompleted = event.status === "completed";
  const hasSocials = Boolean(event.instagram || event.youtube);

  return (
    <article
      id="featured-event"
      data-event-id={event.id}
      className="group relative w-full overflow-hidden rounded-[16px] border border-outline-variant bg-on-surface"
    >
      <div className="relative min-h-[38rem] w-full sm:h-[480px] sm:min-h-0 md:h-[560px]">
        <AppImage
          src={event.image}
          alt={event.name}
          fill
          sizes="(min-width: 1024px) 1200px, 100vw"
          className={cn(
            "object-cover transition-opacity duration-500",
            isCompleted && "opacity-50",
          )}
          referrerPolicy="no-referrer"
          unoptimized
          priority
        />

        <div
          className="absolute inset-0 bg-gradient-to-r from-on-surface via-on-surface/70 to-on-surface/30"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-on-surface/80 via-transparent to-on-surface/30"
          aria-hidden="true"
        />

        <div className="absolute inset-0 flex flex-col justify-between p-5 text-surface sm:p-8 md:p-10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 font-display text-xs font-bold tracking-widest text-surface/80 uppercase">
                <Trophy size={12} aria-hidden="true" className="text-surface" />
                <span>Featured Event</span>
              </div>
              <span className="self-start rounded-[8px] border border-surface/70 bg-on-surface/30 px-2.5 py-1 font-display text-xs font-bold tracking-widest text-surface uppercase">
                {event.categoryName}
              </span>
            </div>

            <div className="flex items-start gap-2">
              {hasSocials && (
                <ul
                  aria-label={`${event.name} social profiles`}
                  className="flex items-center gap-1.5"
                >
                  {event.instagram && (
                    <li>
                      <a
                        href={event.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${event.name} on Instagram`}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-[9999px] border border-surface/40 text-surface transition-colors hover:bg-surface/10 focus-visible:outline-offset-4"
                      >
                        <Instagram size={14} aria-hidden="true" />
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
                        className="inline-flex h-11 w-11 items-center justify-center rounded-[9999px] border border-surface/40 text-surface transition-colors hover:bg-surface/10 focus-visible:outline-offset-4"
                      >
                        <Youtube size={14} aria-hidden="true" />
                      </a>
                    </li>
                  )}
                </ul>
              )}
              {isLive && (
                <div className="flex items-center gap-2 self-start rounded-[8px] border border-error bg-on-surface/30 px-3 py-1 font-display text-xs font-bold tracking-widest text-error uppercase">
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full bg-error animate-pulse-dot"
                  />
                  <span>Live</span>
                </div>
              )}
            </div>
          </div>

          <div className="max-w-3xl space-y-5">
            <h2 className="font-display text-4xl font-bold leading-[0.95] tracking-[-0.03em] text-surface uppercase sm:text-5xl md:text-6xl">
              {event.name}
            </h2>

            <p className="max-w-2xl text-sm leading-relaxed text-surface/85 sm:text-base">
              {event.description}
            </p>

            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-8">
              <div className="flex items-center gap-3 border-t border-surface/30 pt-3">
                <Calendar
                  size={16}
                  className="shrink-0 text-surface"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <dt className="font-display text-xs font-bold tracking-widest text-surface/60 uppercase">
                    Date
                  </dt>
                  <dd className="font-display text-sm font-bold tracking-wide text-surface uppercase sm:text-base">
                    {event.dateRangeLabel}
                  </dd>
                </div>
              </div>
              <div className="flex items-center gap-3 border-t border-surface/30 pt-3">
                <MapPin
                  size={16}
                  className="shrink-0 text-surface"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <dt className="font-display text-xs font-bold tracking-widest text-surface/60 uppercase">
                    Location
                  </dt>
                  <dd className="font-display text-sm font-bold tracking-wide text-surface uppercase sm:text-base truncate">
                    {location.city}
                    {location.country ? `, ${location.country}` : ""}
                    {location.venue && (
                      <span className="block font-display text-xs font-normal tracking-wider text-surface/70 normal-case">
                        {location.venue}
                      </span>
                    )}
                  </dd>
                </div>
              </div>
            </dl>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              {event.url ? (
                <a
                  href={event.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Visit ${event.name} official site in a new tab`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-[9999px] bg-primary px-5 py-3 font-display text-xs font-bold tracking-widest text-on-primary uppercase transition-[background-color,transform] hover:bg-primary/90 focus-visible:outline-offset-4 active:translate-y-px sm:px-6"
                >
                  <span>Visit official site</span>
                  <ExternalLink
                    size={14}
                    aria-hidden="true"
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </a>
              ) : null}

              {event.sports.length > 0 && (
                <ul aria-label="Disciplines" className="flex flex-wrap gap-1.5">
                  {event.sports.map((sport) => (
                    <li
                      key={sport}
                      className="rounded-[8px] border border-surface/40 bg-on-surface/30 px-2.5 py-1 font-display text-xs font-bold tracking-widest text-surface uppercase"
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
                  className="inline-flex min-h-11 items-center justify-between gap-2 rounded-[9999px] border border-surface/40 bg-on-surface/20 px-4 py-2 font-display text-xs font-bold tracking-widest text-surface uppercase transition-colors hover:bg-on-surface/40 focus-visible:outline-offset-4"
                >
                  <span>View spots and events in {event.location.country}</span>
                  <MapPinned
                    size={12}
                    aria-hidden="true"
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
