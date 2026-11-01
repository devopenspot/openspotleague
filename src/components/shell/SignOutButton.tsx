'use client';

import { LogOut } from 'lucide-react';
import { useSignOut } from '@/hooks/ui/useSignOut';
import { cn } from '@/lib/utils/cn';

interface SignOutButtonProps {
  variant?: 'icon' | 'drawer';
  className?: string;
}

const BASE_CLASSES =
  'inline-flex items-center justify-center rounded-full border border-outline-variant text-secondary hover:text-on-surface hover:border-outline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface transition-all disabled:opacity-60 disabled:cursor-not-allowed';

const VARIANT_CLASSES: Record<NonNullable<SignOutButtonProps['variant']>, string> = {
  icon: 'h-8 w-8 bg-surface-bright',
  drawer:
    'w-full gap-2 rounded-full border border-outline bg-surface-container-low px-4 py-2.5 text-[10px] font-display font-bold uppercase tracking-widest text-on-surface hover:bg-surface-container',
};

export function SignOutButton({ variant = 'icon', className }: SignOutButtonProps) {
  const { signOut, pending, isSignedIn } = useSignOut();
  if (!isSignedIn) return null;

  const label = pending ? 'Signing out…' : 'Sign out';

  return (
    <button
      id="sign-out-btn"
      type="button"
      onClick={signOut}
      disabled={pending}
      aria-label={label}
      aria-busy={pending}
      className={cn(BASE_CLASSES, VARIANT_CLASSES[variant], className)}
    >
      <LogOut
        size={14}
        aria-hidden="true"
        className={variant === 'drawer' ? '-ml-1' : undefined}
      />
      {variant === 'drawer' ? <span>{label}</span> : null}
    </button>
  );
}
