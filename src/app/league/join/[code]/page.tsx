import { JoinWithInvite } from "@/components/league/JoinWithInvite";
import { LeagueWash } from "@/components/league/landing/LeagueWash";

export const metadata = {
  title: "Join a contest",
  description: "You were invited to a contest on OpenSpot League.",
  robots: { index: false, follow: false },
};

export default async function JoinByCodePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return (
    <LeagueWash>
      <JoinWithInvite code={code} />
    </LeagueWash>
  );
}
