import { useEffect } from 'react';

export type ShortcutHandler = (e: KeyboardEvent) => void;

export interface ShortcutMap {
  /** Matches when the user presses the given key (case-insensitive) with optional modifiers. */
  key: string;
  cmdOrCtrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: ShortcutHandler;
  /** When false, the listener is detached. */
  enabled?: boolean;
}

export function useKeyboardShortcuts(shortcuts: ShortcutMap[]) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      for (const s of shortcuts) {
        if (!s?.key || typeof e.key !== 'string') continue;
        if (s.enabled === false) continue;
        const keyMatch = e.key.toLowerCase() === s.key.toLowerCase();
        const cmdMatch = !!s.cmdOrCtrl === (e.metaKey || e.ctrlKey);
        const shiftMatch = !!s.shift === e.shiftKey;
        const altMatch = !!s.alt === e.altKey;
        if (keyMatch && cmdMatch && shiftMatch && altMatch) {
          s.handler(e);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shortcuts]);
}
