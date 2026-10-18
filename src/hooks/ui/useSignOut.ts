'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useUser } from '@/lib/contexts/user-context';
import { showToast } from '@/hooks/ui/useToast';

export function useSignOut() {
  const router = useRouter();
  const user = useUser();
  const [pending, startTransition] = useTransition();

  const signOut = () => {
    if (!user) return;
    startTransition(async () => {
      try {
        const res = await fetch('/api/auth/signout', { method: 'POST' });
        const data = (await res.json().catch(() => null)) as
          | { ok?: boolean; error?: string }
          | null;
        if (!res.ok || !data?.ok) {
          showToast(data?.error ?? 'Sign-out failed', 'error');
          return;
        }
        showToast('Signed out', 'success');
        router.push('/');
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Sign-out failed';
        showToast(msg, 'error');
      }
    });
  };

  return { signOut, pending, isSignedIn: user !== null } as const;
}
