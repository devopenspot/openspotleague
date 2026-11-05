"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Medal, Plus } from "lucide-react";
import { JoinByCodeEntry } from "@/components/league/JoinByCodeEntry";
import { ContestDirectory } from "@/components/league/landing/ContestDirectory";
import { ContestResultsSummary } from "@/components/league/landing/ContestResultsSummary";
import { ContestStatusFilter } from "@/components/league/landing/ContestStatusFilter";
import { MyContests } from "@/components/league/landing/MyContests";
import {
  EYEBROW_ON_GRADIENT,
  PAGE_TITLE,
  SECTION_TITLE,
  controlClass,
  pageContainer,
} from "@/components/ui/recipes";
import { useUser } from "@/lib/contexts/user-context";
import { orderEventsForDirectory } from "@/lib/league/directory-order";
import { useEventStatusFilter } from "@/lib/league/status-filter";
import { CONTEST_NEW_PATH, LEAGUE_RANKING_PATH } from "@/lib/league/urls";
import type { ContestEnriched } from "@/types/league";

interface LeagueLandingProps {
  featured: ContestEnriched | undefined;
  /** Public contests only (`visibility = 'public'`, paid or curated plans). */
  events: readonly ContestEnriched[];
}

/**
 * League landing (`/league`): hero with join-by-code and the create CTA,
 * the signed-in viewer's own contests, then the public contest directory.
 * Free-plan contests never appear in the directory — they are shared by
 * QR code or invite link.
 */
export function LeagueLanding({ featured, events }: LeagueLandingProps) {
  const { status, filter } = useEventStatusFilter();
  const user = useUser();

  const visibleEvents = useMemo(
    () => orderEventsForDirectory(filter(events)),
    [filter, events],
  );
  const featuredEvent = useMemo(() => {
    if (status === "completed") return undefined;
    if (featured && visibleEvents.some((event) => event.id === featured.id)) {
      return featured;
    }
    return visibleEvents.find((event) => event.status !== "completed");
  }, [featured, status, visibleEvents]);
  const listEvents = featuredEvent
    ? visibleEvents.filter((event) => event.id !== featuredEvent.id)
    : visibleEvents;

  return (
    <div
      id="league-landing"
      className={`${pageContainer("7xl", { padY: false })} flex flex-1 flex-col gap-10 py-8 animate-fade-in md:gap-12 md:py-10`}
    >
      <header className="flex flex-col gap-6">
        <div className="max-w-3xl">
          <p className={EYEBROW_ON_GRADIENT}>OpenSpot League</p>
          <h1
            id="league-title"
            className={`mt-2 ${PAGE_TITLE} text-on-gradient md:text-5xl`}
          >
            Contests
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-on-gradient/85">
            Run your own skate, BMX, scooter and roller contests: invite riders
            with a QR code or run video contests, judge on the five World Skate
            criteria, publish results and earn league points.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <JoinByCodeEntry variant="onWash" />
          {user ? (
            <Link href={CONTEST_NEW_PATH} className={controlClass("onWashDark")}>
              <Plus size={14} aria-hidden="true" />
              Create a contest
            </Link>
          ) : null}
          {user ? (
            <Link href={LEAGUE_RANKING_PATH} className={controlClass("onWash")}>
              <Medal size={14} aria-hidden="true" />
              Ranking
            </Link>
          ) : null}
        </div>
      </header>

      {user ? <MyContests /> : null}

      <section
        id="public-contests"
        aria-labelledby="public-contests-heading"
        className="flex flex-col gap-10 md:gap-12"
      >
        <div className="flex flex-col gap-4 border-t border-on-gradient/20 pt-6">
          <div>
            <p className={EYEBROW_ON_GRADIENT}>Open to everyone</p>
            <h2
              id="public-contests-heading"
              className={`mt-1 ${SECTION_TITLE} text-on-gradient`}
            >
              Public contests
            </h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <ContestStatusFilter events={events} />
            <ContestResultsSummary
              visibleCount={visibleEvents.length}
              totalCount={events.length}
            />
          </div>
        </div>

        <ContestDirectory
          featured={featuredEvent}
          events={listEvents}
          status={status}
        />
      </section>
    </div>
  );
}
