'use client';

import { X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useToast, type Toast, type ToastTone } from '@/hooks/ui/useToast';
import { cn } from '@/lib/utils/cn';

const TONE_TAG: Record<ToastTone, string> = {
  info: 'INFO',
  success: 'OK',
  error: 'ERR',
};

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
  index: number;
}

function ToastItem({ toast, onDismiss, index }: ToastItemProps) {
  const reduced = useReducedMotion();
  const isError = toast.tone === 'error';

  return (
    <motion.div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      aria-atomic="true"
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: -4 }}
      transition={{
        duration: 0.16,
        ease: 'easeOut',
        delay: reduced ? 0 : index * 0.04,
      }}
      className="pointer-events-auto relative flex items-stretch gap-2 rounded-[16px] border border-outline-variant bg-surface-container-lowest p-2 shadow-sm"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3 rounded-[12px] px-3 py-2">
        <span
          aria-hidden="true"
          className="shrink-0 font-display text-[10px] font-bold tracking-widest text-on-surface uppercase"
        >
          [ {TONE_TAG[toast.tone]} ]
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          {toast.title ? (
            <span className="font-display text-xs font-bold tracking-widest text-on-surface uppercase">
              {toast.title}
            </span>
          ) : null}
          <span
            className={cn(
              'min-w-0 text-xs text-on-surface',
              toast.title ? 'font-normal' : 'font-semibold',
            )}
          >
            {toast.message}
          </span>
        </div>
        {toast.action ? (
          <button
            type="button"
            onClick={() => {
              toast.action?.onClick();
              onDismiss(toast.id);
            }}
            className="min-h-9 shrink-0 rounded-full border border-outline-variant bg-surface-container-high px-3 font-display text-[10px] font-bold tracking-widest text-on-surface uppercase transition-colors hover:bg-surface-container hover:text-primary focus-visible:text-primary"
          >
            {toast.action.label}
          </button>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="flex h-11 w-11 shrink-0 items-center justify-center self-center rounded-full bg-surface-container-high text-on-surface transition-colors hover:bg-surface-container focus-visible:bg-surface-container"
      >
        <X size={12} aria-hidden="true" />
      </button>
    </motion.div>
  );
}

export function ToastViewport({
  placement = "bottom",
}: {
  /** `top` clears the game sheet, which owns the bottom of the screen on phones. */
  placement?: "bottom" | "top";
}) {
  const { toasts, overflow, dismiss } = useToast();
  if (toasts.length === 0 && overflow === 0) return null;

  return (
    <div
      aria-label="Notifications"
      role="region"
      className={`pointer-events-none fixed left-1/2 z-[1400] flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 flex-col items-stretch gap-2 md:top-auto md:bottom-6 ${placement === "top" ? "top-[calc(env(safe-area-inset-top)+0.5rem)]" : "bottom-[calc(var(--mobile-nav-h,80px)+1rem)]"}`}
    >
      <AnimatePresence initial={false}>
        {toasts.map((t, i) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} index={i} />
        ))}
      </AnimatePresence>
      {overflow > 0 ? (
        <div
          aria-live="polite"
          className="pointer-events-auto self-center rounded-[16px] border border-outline-variant bg-surface-container-lowest px-3 py-2 font-display text-[10px] font-bold tracking-widest text-on-surface uppercase shadow-sm"
        >
          +{overflow} more
        </div>
      ) : null}
    </div>
  );
}
