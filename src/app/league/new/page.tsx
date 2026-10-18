import { LeagueCreateForm } from '@/components/league/create/LeagueCreateForm';
import { requireUserOrRedirect } from '@/lib/auth/server';
import { getProfileSummary } from '@/lib/services/profile/profile';

export const metadata = {
  title: 'Create a league event',
  description: 'Organize a competition: riders, judges, schedule, results.',
};

export default async function LeagueNewPage() {
  const user = await requireUserOrRedirect('/league/new');
  const summary = await getProfileSummary(user.id).catch(() => null);
  return <LeagueCreateForm organizerName={summary?.user.name} />;
}
