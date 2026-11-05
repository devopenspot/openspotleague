import { LeagueCreateForm } from '@/components/league/create/LeagueCreateForm';
import { pageContainer } from '@/components/ui/recipes';
import { requireUserOrRedirect } from '@/lib/auth/server';
import { getProfileSummary } from '@/lib/services/profile/profile';
import { CONTEST_NEW_PATH } from '@/lib/league/urls';

export const metadata = {
  title: 'Create a contest',
  description: 'Organize a contest: riders, judges, schedule, results.',
};

export default async function LeagueNewPage() {
  const user = await requireUserOrRedirect(CONTEST_NEW_PATH);
  const summary = await getProfileSummary(user.id).catch(() => null);
  return (
    <div className={pageContainer('3xl')}>
      <LeagueCreateForm organizerName={summary?.user.name} />
    </div>
  );
}
