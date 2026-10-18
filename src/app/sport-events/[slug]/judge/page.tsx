import { notFound, redirect } from "next/navigation";
import { JudgeQueue } from "@/components/league/judge/JudgeQueue";
import { getSessionUser } from "@/lib/auth/server";
import {
  getLeagueEventState,
  resolveLeagueEventIdBySlug,
} from "@/lib/services/league";

export const metadata = {
  title: "Judge queue",
  description: "Score live runs for this league sport event.",
};

export default async function JudgePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/sport-events/${slug}/judge`)}`);
  }
  const resolved = await resolveLeagueEventIdBySlug(slug);
  if (!resolved) notFound();
  const state = await getLeagueEventState(resolved.id, user.id);
  if (!state) notFound();
  const role = state.myRole;
  if (role !== "main_organizer" && role !== "organizer" && role !== "judge") {
    redirect(`/sport-events/${slug}`);
  }
  return <JudgeQueue eventId={resolved.id} slug={slug} />;
}
