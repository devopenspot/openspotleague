import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  ExternalLink,
  Instagram,
  MapPin,
  Youtube,
} from "lucide-react";
import { ContestCover } from "@/components/league/landing/ContestCover";
import type { ContestEnriched } from "@/types/league";
import {
  controlClass,
  iconButtonClass,
  tagClass,
} from "@/components/ui/recipes";
import { cn } from "@/lib/utils/cn";
import { buildContestDetailUrl } from "@/lib/league/urls";

interface ContestFeaturedHeroProps {
  event: ContestEnriched;
}

/**
 * Featured contest: a dark photo hero (bg-on-surface) with one scrim, the
 * contest basics and two actions — View contest (onWire) and Official site
 * (onPhoto). Curators pick it (`featured`); otherwise the next live or
 * upcoming public contest. Disciplines and the map link live on the detail page.
 */
export function ContestFeaturedHero({ event }: ContestFeaturedHeroProps) {
  const { location } = event;
  const isLive = event.status === "live";
  const isCompleted = event.status === "completed";
  const place = [location.city, location.country].filter(Boolean).join(", ");

  return (
    <article
      id="featured-contest"
      data-contest-id={event.id}
      className="group relative w-full overflow-hidden rounded-container border border-on-gradient/20 bg-on-surface"
    >
      <div className="relative h-[28rem] w-full sm:h-[480px] md:h-[520px]">
        <ContestCover
          image={event.image}
          categoryName={event.categoryName}
          sports={event.sports}
          sizes="(min-width: 1280px) 1200px, 100vw"
          className={cn(
            "object-cover transition-transform duration-500 ease-out group-hover:scale-105",
            isCompleted && "opacity-50",
          )}
          priority
          dimmed={isCompleted}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-on-surface via-on-surface/60 to-on-surface/10 md:bg-gradient-to-r md:from-on-surface md:via-on-surface/70 md:to-transparent"
        />

        <div className="absolute inset-0 flex flex-col justify-between p-5 text-surface sm:p-8 md:p-10">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={tagClass("onPhoto")}>{event.categoryName}</span>
              {isLive ? (
                <span className={tagClass("onPhoto")}>
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-control bg-error"
                  />
                  Live now
                </span>
              ) : null}
            </div>

            {event.instagram || event.youtube ? (
              <ul
                aria-label={`${event.name} social profiles`}
                className="flex items-center gap-1.5"
              >
                {event.instagram ? (
                  <li>
                    <a
                      href={event.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${event.name} on Instagram`}
                      className={iconButtonClass("onPhoto")}
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
                      className={iconButtonClass("onPhoto")}
                    >
                      <Youtube size={16} aria-hidden="true" />
                    </a>
                  </li>
                ) : null}
              </ul>
            ) : null}
          </div>

          <div className="max-w-2xl">
            <h3 className="font-display text-3xl font-bold uppercase leading-none tracking-display text-surface sm:text-5xl md:text-6xl">
              {event.name}
            </h3>
            {event.description ? (
              <p className="mt-3 line-clamp-2 max-w-xl text-sm leading-relaxed text-surface/85 sm:text-base">
                {event.description}
              </p>
            ) : null}

            <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-display text-xs font-bold uppercase tracking-label text-surface sm:text-sm">
              <span className="inline-flex items-center gap-1.5">
                <Calendar size={14} aria-hidden="true" />
                {event.dateRangeLabel}
              </span>
              {place ? (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={14} aria-hidden="true" />
                  {place}
                </span>
              ) : null}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <Link
                href={buildContestDetailUrl(event.slug)}
                className={controlClass("onWire")}
              >
                View contest
                <ArrowRight
                  size={14}
                  aria-hidden="true"
                  className="transition-transform duration-150 ease-out group-hover:translate-x-0.5"
                />
              </Link>
              {event.url ? (
                <a
                  href={event.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${event.name} official site (opens in a new tab)`}
                  className={controlClass("onPhoto")}
                >
                  Official site
                  <ExternalLink size={14} aria-hidden="true" />
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
