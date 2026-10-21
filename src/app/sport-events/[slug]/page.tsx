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
    <main className="mx-auto max-w-7xl px-5 py-8 md:px-8 md:py-10">
      <nav aria-label="Breadcrumb" className="mb-6">
        <Link
          href="/sport-events"
          className="inline-flex items-center gap-2 font-display text-xs font-bold uppercase tracking-widest text-secondary underline underline-offset-4 hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <span aria-hidden="true">←</span> Back to events
        </Link>
      </nav>

      {/* Hero image + header */}
      <section className="overflow-hidden rounded-[16px] border border-outline-variant bg-surface-container-lowest">
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
              <span className="inline-flex items-center gap-1.5 rounded-[8px] border border-surface/60 bg-on-surface/30 px-2.5 py-1 font-display text-xs font-bold tracking-widest text-surface uppercase backdrop-blur-sm">
                <Trophy size={12} aria-hidden="true" />
                {event.categoryName}
              </span>
              {isLive ? (
                <span className="inline-flex items-center gap-1.5 rounded-[8px] bg-surface px-2.5 py-1 font-display text-xs font-bold tracking-widest text-error uppercase">
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full bg-error -dot"
                  />
                  Live
                </span>
              ) : isCompleted ? (
                <span className="inline-flex rounded-[8px] bg-surface/90 px-2.5 py-1 font-display text-xs font-bold tracking-widest text-secondary uppercase">
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
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface/95 text-on-surface transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
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
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface/95 text-on-surface transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
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
            <h1 className="max-w-3xl font-display text-3xl font-bold uppercase leading-none tracking-[-0.02em] text-surface sm:text-4xl md:text-5xl lg:text-6xl">
              {event.name}
            </h1>
            {event.shortName ? (
              <p className="mt-2 font-display text-xs font-bold uppercase tracking-widest text-surface/70">
                {event.shortName}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-surface/90">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface/95 px-2.5 py-1 font-display text-xs font-bold uppercase tracking-wide text-on-surface">
                <Calendar size={12} aria-hidden="true" />
                {event.dateRangeLabel}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface/95 px-2.5 py-1 text-xs font-semibold text-on-surface">
                <MapPin size={12} aria-hidden="true" />
                {event.location.city}
                {event.location.country ? `, ${event.location.country}` : ""}
              </span>
              {event.sports.length > 0 ? (
                <span className="hidden items-center gap-1.5 sm:inline-flex">
                  {event.sports.map((sport) => (
                    <span
                      key={sport}
                      className="rounded-full border border-surface/40 bg-on-surface/30 px-2 py-1 font-display text-[10px] font-bold uppercase tracking-widest text-surface"
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
              <div className="inline-flex items-center gap-2 rounded-[12px] border border-outline-variant bg-surface-container-high px-3 py-2 font-mono text-xs uppercase tracking-widest text-on-surface">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-primary -dot"
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
              <h2 className="font-display text-xs font-bold uppercase tracking-widest text-secondary">
                About
              </h2>
              <p className="max-w-prose text-sm leading-6 text-on-surface-variant sm:text-base">
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
                  <dt className="font-display text-xs font-bold uppercase tracking-widest text-secondary">
                    Date
                  </dt>
                  <dd className="mt-1 font-display text-sm font-semibold uppercase tracking-wide text-on-surface">
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
                  <dt className="font-display text-xs font-bold uppercase tracking-widest text-secondary">
                    Location
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-on-surface">
                    {event.location.city}
                    {event.location.country
                      ? `, ${event.location.country}`
                      : ""}
                  </dd>
                  {event.location.venue ? (
                    <dd className="text-xs uppercase tracking-wider text-secondary">
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
                <span className="w-full font-display text-xs font-bold uppercase tracking-widest text-secondary">
                  Disciplines
                </span>
                {event.sports.map((sport) => (
                  <span
                    key={sport}
                    className="rounded-[8px] border border-outline-variant bg-surface-container-low px-2.5 py-1 font-display text-xs font-bold uppercase tracking-widest text-on-surface"
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
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-display text-xs font-bold uppercase tracking-widest text-on-primary transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
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
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-outline-variant bg-surface-container-high px-4 py-3 font-display text-xs font-bold uppercase tracking-widest text-on-surface transition-colors hover:bg-surface-container-highest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                View on map
                <MapPinned size={14} aria-hidden="true" />
              </a>
            ) : null}

            {hasSocials ? (
              <div className="rounded-[16px] border border-outline-variant bg-surface-container-low p-4">
                <p className="font-display text-xs font-bold uppercase tracking-widest text-secondary">
                  Social
                </p>
                <ul className="mt-3 flex gap-2">
                  {event.instagram ? (
                    <li>
                      <a
                        href={event.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${event.name} on Instagram`}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-lowest px-3 font-display text-xs font-bold uppercase tracking-widest text-on-surface hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
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
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-lowest px-3 font-display text-xs font-bold uppercase tracking-widest text-on-surface hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                      >
                        <Youtube size={12} aria-hidden="true" />
                        YouTube
                      </a>
                    </li>
                  ) : null}
                </ul>
              </div>
            ) : null}

            <p className="px-1 text-center font-display text-[10px] uppercase tracking-widest text-secondary">
              Official event — verify dates on the organizer site
            </p>
          </aside>
        </div>
      </section>
    </main>
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
        <h2 className="font-display text-xs font-bold uppercase tracking-widest text-secondary">
          My performance
        </h2>
        <span className="rounded-md bg-surface-container-high px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-[0.05em] text-on-surface">
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
            <p className="inline-flex items-center gap-2 rounded-[12px] border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface">
              <span className="font-display text-sm font-bold uppercase tracking-wide">
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
                  className="rounded-[8px] border border-outline-variant bg-surface-container-low px-2.5 py-1 font-display text-xs font-bold uppercase tracking-widest text-on-surface"
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
                  className="rounded-[8px] border border-outline-variant bg-surface-container-low px-2.5 py-1 font-display text-xs font-bold uppercase tracking-widest text-on-surface"
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
