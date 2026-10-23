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
    <div className="flex min-h-[60dvh] flex-col items-center justify-center bg-black px-4 py-12 text-center text-white">
      <div className="rounded-[16px] border border-white/10 bg-white/[0.04] p-6 sm:p-8 max-w-md w-full">
        <Tv size={32} className="mx-auto text-white/30" aria-hidden="true" />
        <p className="mt-3 font-mono text-[10px] font-bold uppercase tracking-widest text-white/80">
          TV failed to load
        </p>
        <p className="mt-2 text-xs text-white/60 break-words">
          {error.message || "An unexpected error occurred while loading TV channels."}
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-full bg-white px-5 py-2 font-display text-xs font-bold uppercase tracking-wider text-black transition-colors hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full border border-white/20 bg-transparent px-5 py-2 font-display text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            Reload
          </button>
        </div>
      </div>
    </div>
  );
}
