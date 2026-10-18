import NotificationsTab from '@/components/notifications/NotificationsTab';
import { requireUserOrRedirect } from '@/lib/auth/server';

export const metadata = {
  title: 'Notifications',
  description: 'League invitations, schedules and results.',
};

export default async function NotificationsPage() {
  await requireUserOrRedirect('/notifications');
  return <NotificationsTab />;
}
