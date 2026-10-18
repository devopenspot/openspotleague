'use client';

import { useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  useFocusTrap,
  type FocusTrapInitialFocus,
} from '@/hooks/ui/useFocusTrap';
import { useKeyboardShortcuts } from '@/hooks/ui/useKeyboardShortcuts';
import { useBodyScrollLock } from '@/hooks/ui/useBodyScrollLock';
import { cn } from '@/lib/utils/cn';

interface OverlayProps {
  isOpen: boolean;
  onClose: () => void;
  labelledBy: string;
  describedBy?: string;
  contentId?: string;
  closeOnBackdrop?: boolean;
  children: ReactNode;
  panelClassName?: string;
  containerClassName?: string;
  role?: 'dialog' | 'alertdialog';
  flush?: boolean;
  hideBackdrop?: boolean;
  initialFocus?: FocusTrapInitialFocus;
  animation?: 'center' | 'top';
}

export function Overlay({
  isOpen,
  onClose,
  labelledBy,
  describedBy,
  contentId,
  closeOnBackdrop = true,
  children,
  panelClassName,
  containerClassName,
  role = 'dialog',
  flush = false,
  hideBackdrop = false,
  initialFocus,
  animation = 'center',
}: OverlayProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, isOpen, initialFocus);
  useKeyboardShortcuts(
    isOpen ? [{ key: 'Escape', handler: () => onClose() }] : [],
  );
  useBodyScrollLock(isOpen);
  const reduced = useReducedMotion();
  const isTop = animation === 'top';

  const overlay = (
    <AnimatePresence>
      {isOpen && (
        <div
          id={contentId}
          className={cn(
            'fixed inset-0 z-[1300]',
            flush ? '' : 'flex items-center justify-center overflow-y-auto p-4',
            containerClassName,
          )}
        >
          {!hideBackdrop && (
            <motion.div
              initial={reduced ? { opacity: 0.5 } : { opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={reduced ? { opacity: 0.5 } : { opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={closeOnBackdrop ? onClose : undefined}
              className="fixed inset-0 bg-on-surface"
              aria-hidden="true"
            />
          )}
          <motion.div
            ref={panelRef}
            role={role}
            aria-modal="true"
            aria-labelledby={labelledBy}
            aria-describedby={describedBy}
            tabIndex={-1}
            initial={
              isTop
                ? reduced
                  ? { opacity: 0 }
                  : { y: '-100%' }
                : reduced || flush
                  ? false
                  : { opacity: 0, y: 24, scale: 0.97 }
            }
            animate={
              isTop ? (reduced ? { opacity: 1 } : { y: 0 }) : { opacity: 1, y: 0, scale: 1 }
            }
            exit={
              isTop
                ? reduced
                  ? { opacity: 0 }
                  : { y: '-100%' }
                : reduced || flush
                  ? { opacity: 0 }
                  : { opacity: 0, y: 24, scale: 0.97 }
            }
            transition={
              isTop
                ? reduced
                  ? { duration: 0.18 }
                  : { type: 'spring', damping: 30, stiffness: 320 }
                : { type: 'spring', damping: 25, stiffness: 320 }
            }
            className={cn(
              'relative z-10 outline-none',
              flush
                ? 'flex h-full w-full flex-col'
                : 'mx-auto my-6 w-full max-w-3xl rounded-[16px]',
              panelClassName,
            )}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(overlay, document.body);
  }
  return overlay;
}
