'use client';

import { AlertTriangle } from 'lucide-react';
import { useEffect } from 'react';
import { log } from '@/lib/utils/log';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string; code?: string };
  reset: () => void;
}) {
  useEffect(() => {
    log.error('Route error boundary caught', { message: error.message, digest: error.digest, code: (error as unknown as { code?: string }).code, stack: error.stack } as unknown as never);
  }, [error]);
  const code = (error as unknown as { code?: string }).code;
  const title = code === 'TIMEOUT' ? 'Spot directory is slow' : code === 'INVALID_REF' ? 'Bad filter' : 'Something went wrong';
  const desc =
    code === 'TIMEOUT'
      ? 'We hit a timeout (15s). Try again — the next attempt reuses the cache.'
      : code === 'INVALID_REF'
        ? error.message
        : 'An unexpected error occurred while rendering this view. The rest of the app is still safe to use.';

  return (
    <div
      role="alert"
      className="mx-auto my-12 max-w-md rounded-none-none border border-outline-variant bg-surface-bright p-6 text-center"
    >
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-none-none border border-outline-variant text-error">
        <AlertTriangle size={20} aria-hidden="true" />
      </div>
      <h2 className="font-display text-base font-bold uppercase tracking-wider text-on-surface">
        {title}
      </h2>
      <p className="mt-2 text-xs text-secondary leading-relaxed">
        {desc} {error.digest ? `· Ref ${error.digest.slice(0, 8)}` : ''}
      </p>
      <div className="mt-5 flex justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-none-none bg-on-surface text-surface px-4 py-2 text-xs font-bold tracking-widest uppercase hover:bg-on-surface/90 transition-all"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-none-none border border-outline text-on-surface px-4 py-2 text-xs font-bold tracking-widest uppercase hover:bg-surface-container transition-all"
        >
          Reload
        </button>
      </div>
    </div>
  );
}
