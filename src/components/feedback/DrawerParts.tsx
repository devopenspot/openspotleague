"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";

/** Leaves 40px of the page visible, so it's clear there's a way back. */
export const SIDE_DRAWER_PANEL =
  "w-[min(24rem,calc(100vw-2.5rem))] overflow-hidden rounded-l-lg";

export function DrawerCloseButton({
  label,
  onClose,
  disabled = false,
}: {
  label: string;
  onClose: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClose}
      disabled={disabled}
      aria-label={label}
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-outline-variant bg-surface-container-high text-on-surface transition-colors hover:border-outline hover:bg-surface-container-highest focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 active:translate-y-px disabled:cursor-wait"
    >
      <X size={20} aria-hidden="true" />
    </button>
  );
}

export function DrawerHeader({
  eyebrow,
  title,
  titleId,
  closeLabel,
  onClose,
  closeDisabled,
  children,
}: {
  eyebrow?: string;
  title: ReactNode;
  titleId: string;
  closeLabel: string;
  onClose: () => void;
  closeDisabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="flex shrink-0 items-start justify-between gap-4 border-b border-outline-variant px-5 py-4">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="font-display text-sm font-semibold text-on-surface-variant">
            {eyebrow}
          </p>
        ) : null}
        <h2
          id={titleId}
          className="mt-0.5 font-display text-2xl font-bold leading-tight tracking-[-0.01em] text-on-surface"
        >
          {title}
        </h2>
        {children}
      </div>
      <DrawerCloseButton
        label={closeLabel}
        onClose={onClose}
        disabled={closeDisabled}
      />
    </div>
  );
}

/** Keeps a drawer's actions in thumb reach however long the content is. */
export function DrawerFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex shrink-0 gap-3 border-t border-outline-variant bg-surface-container-lowest p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      {children}
    </div>
  );
}
