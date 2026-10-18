import { notFound } from 'next/navigation';
import { ManageConsole } from '@/components/league/manage/ManageConsole';
import { requireUserOrRedirect } from '@/lib/auth/server';
import { resolveLeagueEventIdBySlug } from '@/lib/services/league';

export const metadata = {
  title: 'Organizer console',
  description: 'Configure and run your league sport event.',
};

export default async function ManagePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await requireUserOrRedirect(`/sport-events/${slug}/manage`);
  const resolved = await resolveLeagueEventIdBySlug(slug);
  if (!resolved) notFound();
  return <ManageConsole eventId={resolved.id} />;
}
