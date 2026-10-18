import LeagueHub from '@/components/league/LeagueHub';
import { requireUserOrRedirect } from '@/lib/auth/server';

export const metadata = {
  title: 'League',
  description: 'Your sport events: organizing, judging and riding.',
};

export default async function LeaguePage() {
  await requireUserOrRedirect('/league');
  return <LeagueHub />;
}
