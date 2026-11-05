import { Suspense } from "react";
import { ContestSkeleton } from "@/components/league/landing/ContestSkeleton";
import { LeagueLanding } from "@/components/league/landing/LeagueLanding";
import { LeagueWash } from "@/components/league/landing/LeagueWash";
import { listContestDirectory } from "@/lib/services/event/events";
import { withSafeDefault } from "@/lib/utils/safe-fetch";

export const metadata = {
  title: "League",
  description:
    "Create skate, BMX, scooter and roller contests, invite riders by QR code, judge live runs and earn league points.",
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
