import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Clock,
  ExternalLink,
  Instagram,
  MapPin,
  MapPinned,
  Trophy,
  Youtube,
} from "lucide-react";
import { AppImage } from "@/components/ui/AppImage";
import { Countdown } from "@/components/ui/Countdown";
import { ShareActions } from "@/components/ui/ShareActions";
import {
  BODY,
  CARD_NESTED,
  EYEBROW,
  LABEL,
  META,
  TILE,
  controlClass,
  pageContainer,
  tagClass,
} from "@/components/ui/recipes";
import { getSessionUser } from "@/lib/auth/server";
import { findEventBySlug } from "@/lib/services/event/events";
import { getMyEventHistoryBySlug } from "@/lib/services/league";
import type { MyEventHistory } from "@/lib/services/league";
import { withSafeDefault } from "@/lib/utils/safe-fetch";
import {
  buildEventDetailUrl,
  buildEventMapUrl,
} from "@/lib/league/urls";
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
  const place = [event.location.city, event.location.country]
    .filter(Boolean)
    .join(", ");

  return (
    <div className={pageContainer("7xl")}>
      <nav aria-label="Breadcrumb" className="mb-6">
        <Link
          href="/sport-events"
          className={`${controlClass("onWash", "sm")} focus-visible:outline-white`}
        >
          <ArrowLeft size={14} aria-hidden="true" /> All events
        </Link>
      </nav>

      <article className="-mx-5 overflow-hidden border-y border-outline-variant bg-surface-container-lowest text-on-surface md:mx-0 md:rounded-container md:border">
        {/* Photo hero — scrim + onPhoto tags (DESIGN.md pages.spot-detail) */}
        <div className="relative h-[320px] w-full overflow-hidden bg-on-surface sm:h-[420px]">
          <AppImage
            src={event.image}
            alt=""
            fill
            sizes="(min-width: 1280px) 1200px, 100vw"
            className={`object-cover${isCompleted ? " opacity-60" : ""}`}
            priority
            unoptimized
            referrerPolicy="no-referrer"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-on-surface/85 via-on-surface/30 to-transparent"
          />

          <div className="absolute inset-x-0 top-0 flex flex-wrap items-center gap-1.5 p-4 sm:p-6">
            <span className={tagClass("onPhoto")}>
              <Trophy size={12} aria-hidden="true" />
              {event.categoryName}
            </span>
            {isLive ? (
              <span className={tagClass("onPhoto")}>
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-control bg-error"
                />
                Live now
              </span>
            ) : isCompleted ? (
              <span className={tagClass("onPhoto")}>Completed</span>
            ) : null}
          </div>

          <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6 md:p-8">
            {event.shortName ? (
              <p className="font-display text-xs font-bold uppercase tracking-eyebrow text-surface/75">
                {event.shortName}
              </p>
            ) : null}
            <h1 className="mt-1 max-w-3xl font-display text-3xl font-bold uppercase leading-none tracking-display text-surface sm:text-5xl md:text-6xl">
              {event.name}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              <span className={tagClass("onPhoto")}>
                <Calendar size={12} aria-hidden="true" />
                {event.dateRangeLabel}
              </span>
              {place ? (
                <span className={tagClass("onPhoto")}>
                  <MapPin size={12} aria-hidden="true" />
                  {place}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid gap-8 p-5 sm:p-6 md:p-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-6">
            {isUpcoming ? (
              <div className={`${TILE} inline-flex items-center gap-3`}>
                <Clock size={16} aria-hidden="true" className="text-secondary" />
                <span className={LABEL}>Starts in</span>
                <Countdown
                  target={event.startDate}
                  label={`${event.name} starts in`}
                  className="text-base text-on-surface"
                />
              </div>
            ) : null}

            {event.description ? (
              <section className="space-y-3" aria-labelledby="event-about">
                <h2 id="event-about" className={EYEBROW}>
                  About
                </h2>
                <p className={`max-w-prose ${BODY} sm:text-base`}>
                  {event.description}
                </p>
              </section>
            ) : null}

            <dl className="grid gap-4 border-t border-outline-variant pt-6 sm:grid-cols-2">
              <div className="flex gap-3">
                <Calendar
                  size={16}
                  className="mt-0.5 shrink-0 text-secondary"
                  aria-hidden="true"
                />
                <div>
                  <dt className={EYEBROW}>Date</dt>
                  <dd className="mt-1 font-display text-sm font-semibold uppercase tracking-dense">
                    {event.dateRangeLabel}
                  </dd>
                  {event.endDate && event.endDate !== event.startDate ? (
                    <dd className="mt-0.5 text-xs text-secondary">
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
                  <dt className={EYEBROW}>Location</dt>
                  <dd className="mt-1 text-sm font-semibold">{place}</dd>
                  {event.location.venue ? (
                    <dd className={`mt-0.5 ${META}`}>{event.location.venue}</dd>
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
              <section
                aria-labelledby="event-disciplines"
                className="space-y-3 border-t border-outline-variant pt-6"
              >
                <h2 id="event-disciplines" className={EYEBROW}>
                  Disciplines
                </h2>
                <ul className="flex flex-wrap gap-1.5">
                  {event.sports.map((sport) => (
                    <li key={sport} className={tagClass("outline")}>
                      {sport}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {myHistory ? <MyPerformance history={myHistory} /> : null}
          </div>

          <aside
            aria-label="Event actions"
            className="space-y-3 self-start lg:sticky lg:top-[calc(var(--app-header-h)+1.5rem)]"
          >
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

            {event.location.country ? (
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
                Spots &amp; events in {event.location.country}
                <MapPinned size={14} aria-hidden="true" />
              </a>
            ) : null}

            <div className={CARD_NESTED}>
              <p className={EYEBROW}>Share</p>
              <ShareActions
                url={buildEventDetailUrl(event.slug)}
                title={event.name}
                className="mt-3"
              />
            </div>

            {hasSocials ? (
              <div className={CARD_NESTED}>
                <p className={EYEBROW}>Follow</p>
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
              Dates can change — confirm on the organizer&apos;s site
            </p>
          </aside>
        </div>
      </article>
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
    <section
      aria-labelledby="event-my-performance"
      className="space-y-3 border-t border-outline-variant pt-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="event-my-performance" className={EYEBROW}>
          My performance
        </h2>
        <span className={tagClass("neutral")}>{role}</span>
      </div>
      {!hasRuns ? (
        <p className={BODY}>Your activity for this event will appear here.</p>
      ) : (
        <div className="space-y-3">
          {history.result ? (
            <dl className="grid grid-cols-3 gap-2 sm:max-w-md">
              <div className={TILE}>
                <dt className={LABEL}>Rank</dt>
                <dd className="mt-1 font-display text-xl font-bold tabular-nums">
                  #{history.result.rank}
                </dd>
              </div>
              <div className={TILE}>
                <dt className={LABEL}>Best run</dt>
                <dd className="mt-1 font-display text-xl font-bold tabular-nums">
                  {history.result.totalScore.toFixed(2)}
                </dd>
              </div>
              <div className={TILE}>
                <dt className={LABEL}>League pts</dt>
                <dd className="mt-1 font-display text-xl font-bold tabular-nums">
                  +{history.result.pointsAwarded}
                </dd>
              </div>
            </dl>
          ) : null}
          {history.myRuns.length > 0 ? (
            <ul aria-label="My runs" className="flex flex-wrap gap-1.5">
              {history.myRuns.map((run) => (
                <li key={run.runId} className={tagClass("neutral")}>
                  Run {run.sequence} · {run.status}
                  {run.myTotal !== null ? ` · ${run.myTotal.toFixed(2)}` : ""}
                </li>
              ))}
            </ul>
          ) : null}
          {history.myJudgements.length > 0 ? (
            <ul aria-label="My judgements" className="flex flex-wrap gap-1.5">
              {history.myJudgements.map((entry) => (
                <li
                  key={`${entry.runId}-${entry.total}`}
                  className={tagClass("neutral")}
                >
                  Run {entry.sequence} judged · {entry.total.toFixed(2)}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </section>
  );
}
