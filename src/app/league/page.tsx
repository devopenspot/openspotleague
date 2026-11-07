import type { Metadata } from "next";
import { Suspense } from "react";
import { ContestSkeleton } from "@/components/league/landing/ContestSkeleton";
import { LeagueLanding } from "@/components/league/landing/LeagueLanding";
import { LeagueWash } from "@/components/league/landing/LeagueWash";
import { listContestDirectory } from "@/lib/services/event/events";
import { withSafeDefault } from "@/lib/utils/safe-fetch";
import { OG_IMAGES, ogImage } from "@/lib/og/config";

const LEAGUE_DESCRIPTION =
  "Create skate, BMX, scooter and roller contests, invite riders by QR code, judge live runs and earn league points.";

export const metadata: Metadata = {
  title: "League",
  description: LEAGUE_DESCRIPTION,
  openGraph: {
    type: "website",
    title: "OpenSpot League",
    description: LEAGUE_DESCRIPTION,
    images: [ogImage(OG_IMAGES.league, "OpenSpot League contests")],
  },
  twitter: {
    card: "summary_large_image",
    title: "OpenSpot League",
    description: LEAGUE_DESCRIPTION,
    images: [OG_IMAGES.league],
  },
};

async function LeagueContent() {
  const { events, featured } = await withSafeDefault(
    () => listContestDirectory(),
    { events: [], featured: undefined },
    "listContestDirectory",
  );
  return <LeagueLanding featured={featured} events={events} />;
}

export default function LeaguePage() {
  return (
    <LeagueWash>
      <Suspense fallback={<ContestSkeleton />}>
        <LeagueContent />
      </Suspense>
    </LeagueWash>
  );
}
