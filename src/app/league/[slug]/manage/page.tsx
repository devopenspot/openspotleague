import { notFound } from "next/navigation";
import { LeagueWash } from "@/components/league/landing/LeagueWash";
import { ManageConsole } from "@/components/league/manage/ManageConsole";
import { requireUserOrRedirect } from "@/lib/auth/server";
import { buildContestManageUrl } from "@/lib/league/urls";
import { resolveLeagueEventIdBySlug } from "@/lib/services/league";

export const metadata = {
  title: "Organizer console",
  description: "Configure and run your contest.",
  robots: { index: false, follow: false },
};

export default async function ManagePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await requireUserOrRedirect(buildContestManageUrl(slug));
  const resolved = await resolveLeagueEventIdBySlug(slug);
  if (!resolved) notFound();
  return (
    <LeagueWash>
      <ManageConsole eventId={resolved.id} />
    </LeagueWash>
  );
}
