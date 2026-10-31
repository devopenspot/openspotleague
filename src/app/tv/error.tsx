"use client";

import { useEffect } from "react";
import { Tv } from "lucide-react";

export default function TvError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isChunkError =
      error.name === "ChunkLoadError" ||
      /Loading chunk [\d\w_-]+ failed/i.test(error.message) ||
      /Failed to fetch dynamically imported module/i.test(error.message) ||
      /Importing a module script failed/i.test(error.message);

    if (isChunkError) {
      const key = `osp_tv_chunk_reload_${error.digest || error.message}`;
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        window.location.reload();
      }
    }
  }, [error]);

  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center px-4 py-12 text-center text-on-wire">
      <div className="rounded-[16px] border border-wire-border bg-tv-overlay p-6 sm:p-8 max-w-md w-full">
        <Tv size={32} className="mx-auto text-wire-muted" aria-hidden="true" />
        <p className="mt-3 text-sm font-semibold text-on-wire">
          TV didn&apos;t load
        </p>
        <p className="mt-1 text-xs text-wire-muted break-words">
          Check your connection and try again.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-full bg-on-wire px-5 py-2 font-display text-xs font-bold uppercase tracking-wider text-black transition-colors hover:bg-on-wire/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-wire"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full border border-wire-border-strong bg-transparent px-5 py-2 font-display text-xs font-bold uppercase tracking-wider text-on-wire transition-colors hover:bg-wire-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-wire"
          >
            Reload
          </button>
        </div>
      </div>
    </div>
  );
}
