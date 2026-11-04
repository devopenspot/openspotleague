'use client';

import { LogOut } from 'lucide-react';
import { useSignOut } from '@/hooks/ui/useSignOut';
import { cn } from '@/lib/utils/cn';
import { controlClass, iconButtonClass } from '@/components/ui/recipes';

type SignOutVariant = 'icon' | 'drawer' | 'wire' | 'profile';

interface SignOutButtonProps {
  variant?: SignOutVariant;
  className?: string;
}

const VARIANT_CLASSES: Record<SignOutVariant, string> = {
  // Small circular icon on light surfaces.
  icon: iconButtonClass('outline', 'sm'),
  // Full-width labelled pill on light surfaces.
  drawer: `${controlClass('outline')} w-full`,
  // Full-width labelled pill in the black mobile drawer.
  wire: `${controlClass('onWireOutline')} w-full`,
  // Profile settings row: full width on phones, a 44px circle from sm.
  profile:
    'inline-flex h-control w-full shrink-0 items-center justify-center rounded-control border border-outline-variant bg-surface-container-high text-on-surface transition-[background-color,border-color,transform] duration-150 ease-out hover:border-outline active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60 sm:w-control',
};

const SHOWS_LABEL: Record<SignOutVariant, boolean> = {
  icon: false,
  drawer: true,
  wire: true,
  profile: false,
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
      className={cn(VARIANT_CLASSES[variant], className)}
    >
      <LogOut
        size={SHOWS_LABEL[variant] ? 14 : 16}
        aria-hidden="true"
      />
      {SHOWS_LABEL[variant] ? <span>{label}</span> : null}
    </button>
  );
}
