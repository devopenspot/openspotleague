import { JoinWithInvite } from '@/components/league/JoinWithInvite';

export const metadata = {
  title: 'Join a league event',
  description: 'You were invited to a league sport event.',
};

export default async function JoinByCodePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <JoinWithInvite code={code} />;
}
