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
      <h2 className="font-display text-base font-bold uppercase text-on-surface">Spot unavailable</h2>
      <p className="mt-2 text-xs leading-relaxed text-secondary">{error.message || "This spot threw while rendering."} {error.digest ? `· Ref ${error.digest.slice(0, 8)}` : ""}</p>
      <div className="mt-5 flex justify-center gap-2">
        <button type="button" onClick={reset} className="min-h-11 rounded-full bg-on-surface px-4 text-xs font-bold uppercase text-surface hover:bg-on-surface/90">
          Try again
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="min-h-11 rounded-full border border-outline px-4 text-xs font-bold uppercase text-on-surface hover:bg-surface-container"
        >
          Reload
        </button>
        <Link href="/explore" className="min-h-11 rounded-full border border-outline px-4 text-xs font-bold uppercase flex items-center hover:bg-surface-container">
          Back to directory
        </Link>
      </div>
    </div>
  );
}
