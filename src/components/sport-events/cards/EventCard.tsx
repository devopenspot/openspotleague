import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  ExternalLink,
  Instagram,
  MapPin,
  Youtube,
} from "lucide-react";
import { AppImage } from "@/components/ui/AppImage";
import type { ContestEnriched, ContestStatus } from "@/types/league";
import {
  BODY,
  CARD_FRAME,
  CARD_TITLE,
  META,
  iconButtonClass,
  tagClass,
} from "@/components/ui/recipes";
import { cn } from "@/lib/utils/cn";
import { buildEventDetailUrl } from "@/lib/league/urls";

export type EventCardVariant = "default" | "compact";

interface EventCardProps {
  event: ContestEnriched;
  priority?: boolean;
  /** `compact` is the quieter Past-events card: shorter photo, no description. */
  variant?: EventCardVariant;
}

const STATUS_LABEL: Record<ContestStatus, string> = {
  live: "Live now",
  upcoming: "Upcoming",
  completed: "Completed",
};

const STATUS_DOT: Record<ContestStatus, string> = {
  live: "bg-error",
  upcoming: "bg-on-surface",
  completed: "bg-outline",
};

/**
 * Directory card. The whole card opens the internal event page through a
 * stretched title link; the official site and socials are the only other
 * targets, as icon buttons in the footer (raised above the stretched link).
 */
export function EventCard({
  event,
  priority = false,
  variant = "default",
}: EventCardProps) {
  const { location } = event;
  const compact = variant === "compact";
  const isCompleted = event.status === "completed";
  const href = buildEventDetailUrl(event.slug);
  const place = [location.city, location.country].filter(Boolean).join(", ");

  return (
    <article
      data-event-card={event.id}
      data-event-status={event.status}
      className={`group relative flex h-full w-full flex-col overflow-hidden ${CARD_FRAME} text-on-surface transition-colors duration-150 ease-out hover:border-on-surface focus-within:border-on-surface`}
    >
      <div
        className={cn(
          "relative w-full overflow-hidden bg-on-surface",
          compact ? "h-36" : "h-48 sm:h-52",
        )}
      >
        <AppImage
          src={event.image}
          alt=""
          fill
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className={cn(
            "pointer-events-none object-cover",
            !compact &&
              "transition-transform duration-300 ease-out group-hover:scale-102",
            isCompleted && "opacity-60 grayscale",
          )}
          referrerPolicy="no-referrer"
          unoptimized
          priority={priority}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-on-surface/45 via-transparent to-transparent"
        />
        <div className="absolute left-3 top-3 flex flex-wrap items-center gap-1.5">
          <span className={tagClass("onPhoto")}>{event.categoryName}</span>
          {event.status === "live" ? (
            <span className={tagClass("onPhoto")}>
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-control bg-error"
              />
              Live
            </span>
          ) : null}
        </div>
      </div>

      <div className={cn("flex flex-1 flex-col", compact ? "p-4" : "p-5")}>
        <p className={`flex items-center gap-2 ${META}`}>
          <span
            aria-hidden="true"
            className={cn(
              "h-1.5 w-1.5 shrink-0 rounded-control",
              STATUS_DOT[event.status],
            )}
          />
          <span className={event.status === "live" ? "text-error" : undefined}>
            {STATUS_LABEL[event.status]}
          </span>
        </p>

        <h3
          className={cn(
            "mt-2",
            compact
              ? "font-display text-base font-bold uppercase leading-tight tracking-tight"
              : CARD_TITLE,
          )}
        >
          <Link
            href={href}
            className="after:absolute after:inset-0 after:z-0 after:rounded-container after:content-[''] group-hover:underline focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-primary"
          >
            {event.name}
          </Link>
        </h3>

        {!compact && event.description ? (
          <p className={`mt-2 line-clamp-2 ${BODY}`}>{event.description}</p>
        ) : null}

        <dl
          className={cn(
            "space-y-1.5 text-xs",
            compact ? "mt-3" : "mt-4 border-t border-outline-variant pt-3",
          )}
        >
          <div className="flex items-start gap-2">
            <Calendar
              size={12}
              className="mt-0.5 shrink-0 text-secondary"
              aria-hidden="true"
            />
            <dt className="visually-hidden">Date</dt>
            <dd className="font-display font-semibold uppercase tracking-label">
              {event.dateRangeLabel}
            </dd>
          </div>
          {place ? (
            <div className="flex items-start gap-2">
              <MapPin
                size={12}
                className="mt-0.5 shrink-0 text-secondary"
                aria-hidden="true"
              />
              <dt className="visually-hidden">Location</dt>
              <dd className="min-w-0 truncate text-secondary">
                <span className="font-semibold text-on-surface">{place}</span>
                {!compact && location.venue ? ` · ${location.venue}` : ""}
              </dd>
            </div>
          ) : null}
        </dl>

        {!compact && event.sports.length > 0 ? (
          <ul aria-label="Disciplines" className="mt-4 flex flex-wrap gap-1.5">
            {event.sports.map((sport) => (
              <li key={sport} className={tagClass("outline")}>
                {sport}
              </li>
            ))}
          </ul>
        ) : null}

        <div
          className={cn(
            "mt-auto flex items-center justify-between gap-2",
            compact ? "pt-3" : "pt-5",
          )}
        >
          <span
            aria-hidden="true"
            className="inline-flex items-center gap-1.5 font-display text-xs font-bold uppercase tracking-pill text-on-surface"
          >
            View event
            <ArrowRight
              size={14}
              className="transition-transform duration-150 ease-out group-hover:translate-x-0.5"
            />
          </span>
          <EventCardLinks event={event} />
        </div>
      </div>
    </article>
  );
}

function EventCardLinks({ event }: { event: ContestEnriched }) {
  if (!event.url && !event.instagram && !event.youtube) return null;
  const button = `relative z-10 ${iconButtonClass("outline")}`;
  return (
    <ul
      aria-label={`${event.name} links`}
      className="flex items-center gap-1.5"
    >
      {event.instagram ? (
        <li>
          <a
            href={event.instagram}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${event.name} on Instagram`}
            className={button}
          >
            <Instagram size={16} aria-hidden="true" />
          </a>
        </li>
      ) : null}
      {event.youtube ? (
        <li>
          <a
            href={event.youtube}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${event.name} on YouTube`}
            className={button}
          >
            <Youtube size={16} aria-hidden="true" />
          </a>
        </li>
      ) : null}
      {event.url ? (
        <li>
          <a
            href={event.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${event.name} official site (opens in a new tab)`}
            className={button}
          >
            <ExternalLink size={16} aria-hidden="true" />
          </a>
        </li>
      ) : null}
    </ul>
  );
}
