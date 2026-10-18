'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useFocusTrap } from '@/hooks/ui/useFocusTrap';
import { useKeyboardShortcuts } from '@/hooks/ui/useKeyboardShortcuts';
import { cn } from '@/lib/utils/cn';

interface InfoPopoverProps {
  triggerLabel: string;
  trigger: ReactNode;
  children: ReactNode;
  panelClassName?: string;
  align?: 'start' | 'end';
}

export function InfoPopover({
  triggerLabel,
  trigger,
  children,
  panelClassName,
  align = 'end',
}: InfoPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const reduced = useReducedMotion();

  useFocusTrap(panelRef, isOpen);
  useKeyboardShortcuts(
    isOpen ? [{ key: 'Escape', handler: () => setIsOpen(false) }] : [],
  );

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        aria-label={triggerLabel}
        aria-expanded={isOpen}
        aria-controls={panelId}
         className="inline-flex h-11 w-11 items-center justify-center rounded-[4px] text-secondary transition-colors hover:bg-surface-container hover:text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-surface"
      >
        {trigger}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-label={triggerLabel}
            tabIndex={-1}
            initial={reduced ? false : { opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            className={cn(
               'absolute top-full z-50 mt-2 w-60 rounded-[4px] border border-outline-variant bg-surface p-3',
              align === 'end' ? 'right-0' : 'left-0',
              panelClassName,
            )}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
