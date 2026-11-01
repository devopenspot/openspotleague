"use client";

import { useEffect } from "react";
import { log } from "@/lib/utils/log";
import Link from "next/link";

export default function SpotError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    try {
      log.error("Spot segment error", { digest: error.digest, message: error.message } as unknown as never);
    } catch {
      // Must not throw in error boundary
    }
  }, [error]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isChunkError =
      error.name === "ChunkLoadError" ||
      /Loading chunk [\d\w_-]+ failed/i.test(error.message) ||
      /Failed to fetch dynamically imported module/i.test(error.message) ||
      /Importing a module script failed/i.test(error.message);

    if (isChunkError) {
      const key = `osp_spot_chunk_reload_${error.digest || error.message}`;
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        window.location.reload();
      }
    }
  }, [error]);

  return (
    <div role="alert" className="mx-auto my-12 max-w-md rounded-[16px] border border-outline-variant bg-surface-bright p-6 text-center">
      <h2 className="font-display text-2xl font-bold uppercase leading-[1.3] tracking-[-0.02em] text-on-surface">Spot unavailable</h2>
      <p className="mt-2 text-sm font-semibold leading-5 text-secondary">{error.message || "This spot threw while rendering."} {error.digest ? `· Ref ${error.digest.slice(0, 8)}` : ""}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={reset} className="min-h-12 rounded-lg border-2 border-on-surface bg-on-surface px-4 font-display text-sm font-bold uppercase tracking-[0.04em] text-surface transition-[background-color,transform] hover:bg-on-surface/90 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 active:translate-y-px">
          Try again
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="min-h-12 rounded-lg border-2 border-on-surface px-4 font-display text-sm font-bold uppercase tracking-[0.04em] text-on-surface transition-[background-color,transform] hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 active:translate-y-px"
        >
          Reload
        </button>
        <Link href="/explore" className="flex min-h-12 items-center rounded-lg border-2 border-on-surface px-4 font-display text-sm font-bold uppercase tracking-[0.04em] text-on-surface transition-[background-color,transform] hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 active:translate-y-px">
          Back to directory
        </Link>
      </div>
    </div>
  );
}
