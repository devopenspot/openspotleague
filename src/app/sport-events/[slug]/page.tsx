import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Calendar,
  MapPin,
  MapPinned,
  ExternalLink,
  Trophy,
  Instagram,
  Youtube,
} from "lucide-react";
import { AppImage } from "@/components/ui/AppImage";
import { Countdown } from "@/components/ui/Countdown";
import {
  BODY,
  CARD_FRAME,
  CARD_NESTED,
  EYEBROW,
  LABEL,
  controlClass,
  iconButtonClass,
  pageContainer,
  tagClass,
} from "@/components/ui/recipes";
import { getSessionUser } from "@/lib/auth/server";
import { findEventBySlug } from "@/lib/services/event/events";
import { getMyEventHistoryBySlug } from "@/lib/services/league";
import type { MyEventHistory } from "@/lib/services/league";
import { withSafeDefault } from "@/lib/utils/safe-fetch";
import { buildEventMapUrl } from "@/lib/sport-events/urls";
import { truncate } from "@/lib/og/formatters";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  await connection();
  const { slug } = await params;
  const event = await withSafeDefault(
    () => findEventBySlug(slug),
    null,
    "findEventBySlug(metadata)",
  );

  if (!event) {
    return {
      title: "Event unavailable",
      description: "This sport event is currently unavailable.",
      openGraph: {
        title: "Event unavailable",
        description: "This sport event is currently unavailable.",
        type: "website",
        images: [
          {
            url: "/opengraph.png",
            width: 1200,
            height: 630,
            alt: "OpenSpot League",
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        images: ["/opengraph.png"],
      },
    };
  }

  const locationLabel = [event.location.city, event.location.country]
    .filter(Boolean)
    .join(", ");
  const description = truncate(
    [event.categoryName, locationLabel, event.dateRangeLabel, event.description]
      .filter(Boolean)
      .join(" · "),
    200,
  );
  const ogImageUrl = `/sport-events/${encodeURIComponent(event.slug)}/opengraph-image`;

  return {
    title: event.name,
    description,
    openGraph: {
      title: event.name,
      description,
      type: "website",
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: event.name }],
    },
    twitter: {
      card: "summary_large_image",
      title: event.name,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function SportEventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await connection();
  const { slug } = await params;
  const event = await withSafeDefault(
    () => findEventBySlug(slug),
    null,
    "findEventBySlug",
  );
  if (!event) notFound();

  const user = await getSessionUser();
  const myHistory = user
    ? await withSafeDefault(
        () => getMyEventHistoryBySlug(slug, user.id),
        null,
        "getMyEventHistoryBySlug",
      )
    : null;

  const isLive = event.status === "live";
  const isUpcoming = event.status === "upcoming";
  const isCompleted = event.status === "completed";
  const hasSocials = Boolean(event.instagram || event.youtube);

  return (
    <div className={pageContainer("7xl")}>
      <nav aria-label="Breadcrumb" className="mb-6">
        <Link
          href="/sport-events"
          className={`${controlClass("onWash", "sm")} focus-visible:outline-white`}
        >
          <span aria-hidden="true">←</span> Back to events
        </Link>
      </nav>

      {/* Hero image + header */}
      <section className={`overflow-hidden ${CARD_FRAME}`}>
        <div className="relative h-[320px] w-full overflow-hidden bg-on-surface sm:h-[440px]">
          <AppImage
            src={event.image}
            alt={event.name}
            fill
            sizes="(min-width: 1024px) 1200px, 100vw"
            className="object-cover"
            priority
            unoptimized
            referrerPolicy="no-referrer"
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-on-surface/80 via-on-surface/20 to-on-surface/10"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 bg-gradient-to-r from-on-surface/40 via-transparent to-transparent"
            aria-hidden="true"
          />

          {/* top meta row */}
          <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className={tagClass("onPhoto")}>
                <Trophy size={12} aria-hidden="true" />
                {event.categoryName}
              </span>
              {isLive ? (
                <span className="inline-flex items-center gap-1.5 rounded-control bg-surface px-2.5 py-1 font-display text-xs font-bold tracking-label text-error uppercase">
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-control bg-error -dot"
                  />
                  Live
                </span>
              ) : isCompleted ? (
                <span className="inline-flex rounded-control bg-surface/90 px-2.5 py-1 font-display text-xs font-bold tracking-label text-secondary uppercase">
                  Completed
                </span>
              ) : null}
            </div>

            {hasSocials ? (
              <ul
                aria-label={`${event.name} social profiles`}
                className="hidden items-center gap-1.5 sm:flex"
              >
                {event.instagram ? (
                  <li>
                    <a
                      href={event.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${event.name} on Instagram`}
                      className={iconButtonClass("onPhoto", "sm")}
                    >
                      <Instagram size={14} aria-hidden="true" />
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
                      className={iconButtonClass("onPhoto", "sm")}
                    >
                      <Youtube size={14} aria-hidden="true" />
                    </a>
                  </li>
                ) : null}
              </ul>
            ) : null}
          </div>

          {/* bottom title */}
          <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6 md:p-8">
            <h1 className="max-w-3xl font-display text-3xl font-bold uppercase leading-none tracking-display text-surface sm:text-4xl md:text-5xl lg:text-6xl">
              {event.name}
            </h1>
            {event.shortName ? (
              <p className="mt-2 font-display text-xs font-bold uppercase tracking-label text-surface/70">
                {event.shortName}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-surface/90">
              <span className="inline-flex items-center gap-1.5 rounded-control bg-surface/95 px-2.5 py-1 font-display text-xs font-bold uppercase tracking-dense text-on-surface">
                <Calendar size={12} aria-hidden="true" />
                {event.dateRangeLabel}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-control bg-surface/95 px-2.5 py-1 text-xs font-semibold text-on-surface">
                <MapPin size={12} aria-hidden="true" />
                {event.location.city}
                {event.location.country ? `, ${event.location.country}` : ""}
              </span>
              {event.sports.length > 0 ? (
                <span className="hidden items-center gap-1.5 sm:inline-flex">
                  {event.sports.map((sport) => (
                    <span
                      key={sport}
                      className={tagClass("onPhoto")}
                    >
                      {sport}
                    </span>
                  ))}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* details grid */}
        <div className="grid gap-6 p-5 sm:p-6 md:p-8 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            {isUpcoming ? (
              <div className="inline-flex items-center gap-2 rounded-card border border-outline-variant bg-surface-container-high px-3 py-2 font-mono text-xs uppercase tracking-label text-on-surface">
                <span
                  className="h-1.5 w-1.5 rounded-control bg-primary -dot"
                  aria-hidden="true"
                />
                Starts in{" "}
                <Countdown
                  target={event.startDate}
                  label={`${event.name} starts in`}
                />
              </div>
            ) : null}

            <div className="space-y-3">
              <h2 className={EYEBROW}>
                About
              </h2>
              <p className={`max-w-prose ${BODY} sm:text-base`}>
                {event.description}
              </p>
            </div>

            <dl className="grid gap-4 border-t border-outline-variant pt-6 sm:grid-cols-2">
              <div className="flex gap-3">
                <Calendar
                  size={16}
                  className="mt-0.5 shrink-0 text-secondary"
                  aria-hidden="true"
                />
                <div>
                  <dt className={EYEBROW}>
                    Date
                  </dt>
                  <dd className="mt-1 font-display text-sm font-semibold uppercase tracking-dense text-on-surface">
                    {event.dateRangeLabel}
                  </dd>
                  {event.endDate && event.endDate !== event.startDate ? (
                    <dd className="text-xs text-secondary">
                      {event.startDate} → {event.endDate}
                    </dd>
                  ) : null}
                </div>
              </div>
              <div className="flex gap-3">
                <MapPin
                  size={16}
                  className="mt-0.5 shrink-0 text-secondary"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <dt className={EYEBROW}>
                    Location
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-on-surface">
                    {event.location.city}
                    {event.location.country
                      ? `, ${event.location.country}`
                      : ""}
                  </dd>
                  {event.location.venue ? (
                    <dd className="font-display text-xs uppercase tracking-label text-secondary">
                      {event.location.venue}
                    </dd>
                  ) : null}
                  {event.location.address ? (
                    <dd className="mt-1 text-xs text-secondary">
                      {event.location.address}
                    </dd>
                  ) : null}
                </div>
              </div>
            </dl>

            {event.sports.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 border-t border-outline-variant pt-6">
                <span className={`w-full ${EYEBROW}`}>
                  Disciplines
                </span>
                {event.sports.map((sport) => (
                  <span
                    key={sport}
                    className={tagClass("outline")}
                  >
                    {sport}
                  </span>
                ))}
              </div>
            ) : null}

            {myHistory ? <MyPerformance history={myHistory} /> : null}
          </div>

          <aside className="space-y-3 self-start lg:sticky lg:top-6">
            {event.url ? (
              <a
                href={event.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Visit ${event.name} official site in a new tab`}
                className={`${controlClass("primary")} w-full`}
              >
                Visit official site
                <ExternalLink size={14} aria-hidden="true" />
              </a>
            ) : null}

            {event.location.city ? (
              <a
                href={buildEventMapUrl({
                  location: {
                    country: event.location.country,
                    region: event.location.region,
                  },
                })}
                aria-label={`Show spots and events in ${event.location.country} on the map`}
                className={`${controlClass("secondary")} w-full`}
              >
                View on map
                <MapPinned size={14} aria-hidden="true" />
              </a>
            ) : null}

            {hasSocials ? (
              <div className={CARD_NESTED}>
                <p className={EYEBROW}>
                  Social
                </p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {event.instagram ? (
                    <li>
                      <a
                        href={event.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${event.name} on Instagram`}
                        className={controlClass("outline", "sm")}
                      >
                        <Instagram size={12} aria-hidden="true" />
                        Instagram
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
                        className={controlClass("outline", "sm")}
                      >
                        <Youtube size={12} aria-hidden="true" />
                        YouTube
                      </a>
                    </li>
                  ) : null}
                </ul>
              </div>
            ) : null}

            <p className={`px-1 text-center ${LABEL}`}>
              Official event — verify dates on the organizer site
            </p>
          </aside>
        </div>
      </section>
    </div>
  );
}

const ROLE_LABELS: Record<string, string> = {
  main_organizer: "Main organizer",
  organizer: "Organizer",
  judge: "Judge",
  rider: "Rider",
};

/**
 * Member-only summary card (spec `GET /events/[id]/history`): riders see
 * their runs + published result, judges their submissions. Rendered only
 * when the viewer is an active member.
 */
function MyPerformance({ history }: { history: MyEventHistory }) {
  const role = ROLE_LABELS[history.myRole] ?? history.myRole;
  const hasRuns =
    history.myRuns.length > 0 ||
    history.myJudgements.length > 0 ||
    history.result !== null;

  return (
    <div className="space-y-3 border-t border-outline-variant pt-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={EYEBROW}>
          My performance
        </h2>
        <span className={tagClass("neutral")}>
          {role}
        </span>
      </div>
      {!hasRuns ? (
        <p className="text-sm text-secondary">
          Your activity for this event will appear here.
        </p>
      ) : (
        <div className="space-y-3">
          {history.result ? (
            <p className="inline-flex items-center gap-2 rounded-card border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface">
              <span className="font-display text-sm font-bold uppercase tracking-dense">
                Rank #{history.result.rank}
              </span>
              <span aria-hidden="true">·</span>
              {history.result.totalScore.toFixed(2)} run
              <span aria-hidden="true">·</span>+{history.result.pointsAwarded}{" "}
              league pts
            </p>
          ) : null}
          {history.myRuns.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {history.myRuns.map((run) => (
                <li
                  key={run.runId}
                  className="rounded-control border border-outline-variant bg-surface-container-low px-2.5 py-1 font-display text-xs font-bold uppercase tracking-label text-on-surface"
                >
                  Run {run.sequence} · {run.status}
                  {run.myTotal !== null ? ` · ${run.myTotal.toFixed(2)}` : ""}
                </li>
              ))}
            </ul>
          ) : null}
          {history.myJudgements.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5">
              {history.myJudgements.map((entry) => (
                <li
                  key={`${entry.runId}-${entry.total}`}
                  className="rounded-control border border-outline-variant bg-surface-container-low px-2.5 py-1 font-display text-xs font-bold uppercase tracking-label text-on-surface"
                >
                  Run {entry.sequence} judged · {entry.total.toFixed(2)}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </div>
  );
}
