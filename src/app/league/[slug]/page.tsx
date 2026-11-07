import type { Metadata } from "next";
import { OG_IMAGES } from "@/lib/og/config";
import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Clock,
  ClipboardCheck,
  ExternalLink,
  Instagram,
  MapPin,
  MapPinned,
  Settings2,
  Trophy,
  Youtube,
} from "lucide-react";
import { Suspense } from "react";
import { ContestCover } from "@/components/league/landing/ContestCover";
import { ContestHub } from "@/components/league/hub/ContestHub";
import { StandingsBoard } from "@/components/league/hub/StandingsBoard";
import { LeagueWash } from "@/components/league/landing/LeagueWash";
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
import { isOrganizerRole } from "@/lib/league/ui-state";
import {
  buildContestDetailUrl,
  buildContestJudgeUrl,
  buildContestManageUrl,
  buildContestMapUrl,
} from "@/lib/league/urls";
import { ROUTES } from "@/lib/navigation/nav";
import { getContestDetailBySlug } from "@/lib/services/league";
import { withSafeDefault } from "@/lib/utils/safe-fetch";
import { truncate } from "@/lib/og/formatters";

async function loadContest(slug: string, label: string) {
  const user = await getSessionUser();
  return withSafeDefault(
    () => getContestDetailBySlug(slug, user?.id ?? null),
    null,
    label,
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  await connection();
  const { slug } = await params;
  const detail = await loadContest(slug, "getContestDetailBySlug(metadata)");
  const event = detail?.contest ?? null;

  if (!event) {
    return {
      title: "Contest unavailable",
      description: "This contest is currently unavailable.",
      robots: { index: false, follow: false },
      openGraph: {
        title: "Contest unavailable",
        description: "This contest is currently unavailable.",
        type: "website",
        images: [
          {
            url: OG_IMAGES.default,
            width: 1200,
            height: 630,
            alt: "OpenSpot League",
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        images: [OG_IMAGES.default],
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
  if (event.visibility !== "public") {
    // Free-plan contests are private (shared by QR code): never indexed,
    // never given a public share card.
    return {
      title: event.name,
      description,
      robots: { index: false, follow: false },
    };
  }

  const ogImageUrl = `${buildContestDetailUrl(event.slug)}/opengraph-image`;

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

export default async function ContestPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await connection();
  const { slug } = await params;
  const detail = await loadContest(slug, "getContestDetailBySlug");
  if (!detail) notFound();
  const { contest: event, history: myHistory } = detail;
  const isPublic = event.visibility === "public";
  const myRole = myHistory?.myRole ?? null;
  const canManage = myRole !== null && isOrganizerRole(myRole);
  const canJudge = canManage || myRole === "judge";

  const isLive = event.status === "live";
  const isUpcoming = event.status === "upcoming";
  const isCompleted = event.status === "completed";
  const hasSocials = Boolean(event.instagram || event.youtube);
  const place = [event.location.city, event.location.country]
    .filter(Boolean)
    .join(", ");

  return (
    <LeagueWash>
      <div className={pageContainer("7xl")}>
        <nav aria-label="Breadcrumb" className="mb-6">
          <Link
            href={ROUTES.league}
            className={`${controlClass("onWash", "sm")} focus-visible:outline-white`}
          >
            <ArrowLeft size={14} aria-hidden="true" /> All contests
          </Link>
        </nav>

        <article className="-mx-5 overflow-hidden border-y border-outline-variant bg-surface-container-lowest text-on-surface md:mx-0 md:rounded-container md:border">
          {/* Photo hero — scrim + onPhoto tags (DESIGN.md pages.spot-detail) */}
          <div className="relative h-[320px] w-full overflow-hidden bg-on-surface sm:h-[420px]">
            <ContestCover
              image={event.image}
              categoryName={event.categoryName}
              sports={event.sports}
              sizes="(min-width: 1280px) 1200px, 100vw"
              className={`object-cover${isCompleted ? " opacity-60" : ""}`}
              priority
              dimmed={isCompleted}
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

            </div>

            <aside
              aria-label="Contest actions"
              className="space-y-3 self-start lg:sticky lg:top-[calc(var(--app-header-h)+1.5rem)]"
            >
              {canManage ? (
                <Link
                  href={buildContestManageUrl(event.slug)}
                  className={`${controlClass("primary")} w-full`}
                >
                  Run the contest
                  <Settings2 size={14} aria-hidden="true" />
                </Link>
              ) : null}

              {canJudge ? (
                <Link
                  href={buildContestJudgeUrl(event.slug)}
                  className={`${controlClass(canManage ? "secondary" : "primary")} w-full`}
                >
                  Judging
                  <ClipboardCheck size={14} aria-hidden="true" />
                </Link>
              ) : null}

              {event.url ? (
                <a
                  href={event.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Visit ${event.name} official site in a new tab`}
                  className={`${controlClass(canJudge ? "outline" : "primary")} w-full`}
                >
                  Visit official site
                  <ExternalLink size={14} aria-hidden="true" />
                </a>
              ) : null}

              {isPublic && event.location.country ? (
                <a
                  href={buildContestMapUrl({
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

              {isPublic ? (
                <div className={CARD_NESTED}>
                  <p className={EYEBROW}>Share</p>
                  <ShareActions
                    url={buildContestDetailUrl(event.slug)}
                    title={event.name}
                    className="mt-3"
                  />
                </div>
              ) : (
                <div className={CARD_NESTED}>
                  <p className={EYEBROW}>Private contest</p>
                  <p className={`mt-2 ${BODY}`}>
                    Only members see this page. Riders join with the
                    organizer&apos;s QR code or invite link.
                  </p>
                </div>
              )}

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

              {event.url ? (
                <p className={`px-1 text-center ${LABEL}`}>
                  Dates can change — confirm on the organizer&apos;s site
                </p>
              ) : null}
            </aside>
          </div>
        </article>

        {myRole ? (
          <section
            id="hub"
            aria-label="Your contest dashboard"
            className="-mx-5 mt-6 scroll-mt-[calc(var(--app-header-h)+1rem)] border-y border-outline-variant bg-surface-container-lowest p-5 text-on-surface sm:p-6 md:mx-0 md:rounded-container md:border md:p-8"
          >
            <Suspense fallback={null}>
              <ContestHub eventId={event.id} />
            </Suspense>
          </section>
        ) : isPublic ? (
          <section
            id="standings"
            aria-label="Results"
            className="-mx-5 mt-6 border-y border-outline-variant bg-surface-container-lowest p-5 text-on-surface empty:hidden sm:p-6 md:mx-0 md:rounded-container md:border md:p-8"
          >
            <StandingsBoard eventId={event.id} viewerId={null} hideWhenUnavailable />
          </section>
        ) : null}
      </div>
    </LeagueWash>
  );
}
