"use client";

import { useId, type ReactNode } from "react";
import { Overlay } from "@/components/feedback/Overlay";
import { DrawerCloseButton } from "@/components/feedback/DrawerParts";
import { EYEBROW, SECTION_TITLE } from "@/components/ui/recipes";

const WIDTH = {
  md: "max-w-lg",
  lg: "max-w-2xl",
} as const;

/**
 * Shared frame for the read-only info dialogs on the games landing (rules,
 * rider policy). Same surface as the form cards; the header and footer stay
 * pinned and only the body scrolls, so the close control is always in reach.
 */
export function GameInfoDialog({
  isOpen,
  onClose,
  eyebrow,
  title,
  closeLabel,
  width = "md",
  footer,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  eyebrow: string;
  title: ReactNode;
  closeLabel: string;
  width?: keyof typeof WIDTH;
  footer: ReactNode;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <Overlay
      isOpen={isOpen}
      onClose={onClose}
      labelledBy={titleId}
      unsized
      panelClassName={`flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden rounded-container border border-outline-variant bg-surface-container-lowest text-on-surface shadow-[0_16px_48px_rgba(18,18,18,0.16)] ${WIDTH[width]}`}
    >
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-outline-variant px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <p className={EYEBROW}>{eyebrow}</p>
          <h2 id={titleId} className={`mt-1.5 ${SECTION_TITLE}`}>
            {title}
          </h2>
        </div>
        <DrawerCloseButton label={closeLabel} onClose={onClose} />
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
        {children}
      </div>
      <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-outline-variant px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-6 sm:pb-4">
        {footer}
      </footer>
    </Overlay>
  );
}
