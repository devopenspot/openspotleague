import { useCallback, useEffect, useState } from 'react';

export type ToastTone = 'info' | 'success' | 'error';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  message: string;
  tone: ToastTone;
  title?: string;
  action?: ToastAction;
  durationMs: number;
  createdAt: number;
}

export interface ShowToastOptions {
  durationMs?: number;
  title?: string;
  action?: ToastAction;
}

const DEFAULT_DURATION_MS: Record<ToastTone, number> = {
  info: 3000,
  success: 2800,
  error: 6000,
};

const MAX_VISIBLE = 3;

let nextId = 0;
let queue: Toast[] = [];
const subscribers = new Set<(toasts: Toast[]) => void>();
const activeTimers = new Map<string, number>();

function emit() {
  for (const sub of subscribers) sub(queue);
}

function visibleToasts(): Toast[] {
  if (queue.length <= MAX_VISIBLE) return queue;
  return queue.slice(-MAX_VISIBLE);
}

function overflowCount(): number {
  return Math.max(0, queue.length - MAX_VISIBLE);
}

function clearTimer(id: string) {
  const timer = activeTimers.get(id);
  if (timer !== undefined) {
    clearTimeout(timer);
    activeTimers.delete(id);
  }
}

export function showToast(
  message: string,
  tone: ToastTone = 'info',
  options: ShowToastOptions = {},
): string {
  const id = `toast-${++nextId}`;
  const durationMs = options.durationMs ?? DEFAULT_DURATION_MS[tone];

  const dedupKey = `${tone}::${message}`;
  const existing = queue.find(
    (t) => `${t.tone}::${t.message}` === dedupKey,
  );
  if (existing) {
    clearTimer(existing.id);
    queue = queue.filter((t) => t.id !== existing.id);
  }

  const toast: Toast = {
    id,
    message,
    tone,
    durationMs,
    createdAt: Date.now(),
    ...(options.title ? { title: options.title } : {}),
    ...(options.action ? { action: options.action } : {}),
  };
  queue = [...queue, toast];
  emit();

  if (typeof window !== 'undefined' && durationMs > 0) {
    const timer = window.setTimeout(() => {
      dismissToast(id);
    }, durationMs);
    activeTimers.set(id, timer);
  }

  return id;
}

export function dismissToast(id: string) {
  clearTimer(id);
  const before = queue.length;
  queue = queue.filter((t) => t.id !== id);
  if (queue.length !== before) emit();
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>(visibleToasts());
  const [overflow, setOverflow] = useState(0);

  useEffect(() => {
    const sub = (_next: Toast[]) => {
      setToasts(visibleToasts());
      setOverflow(overflowCount());
    };
    subscribers.add(sub);
    return () => {
      subscribers.delete(sub);
    };
  }, []);

  const dismiss = useCallback((id: string) => {
    dismissToast(id);
  }, []);

  return { toasts, overflow, dismiss } as const;
}
