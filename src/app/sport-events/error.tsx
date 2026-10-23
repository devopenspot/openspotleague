"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";
import { log } from "@/lib/utils/log";

export default function SportEventsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    try {
      log.error("Sport events route error", error);
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
      const key = `osp_events_chunk_reload_${error.digest || error.message}`;
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        window.location.reload();
      }
    }
  }, [error]);

  return (
    <div
      role="alert"
      className="mx-auto my-12 max-w-md rounded-[16px] border border-outline-variant bg-surface-container-lowest p-6 text-center"
    >
      <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-[16px] border border-outline-variant bg-surface-container-high text-error">
        <AlertTriangle size={20} aria-hidden="true" />
      </div>
      <h2 className="font-display text-base font-bold uppercase tracking-wider text-on-surface">
        Events are temporarily unavailable
      </h2>
      <p className="mt-2 text-xs leading-relaxed text-secondary">
        We could not load the event circuit. Try again without leaving this
        page.
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-11 items-center rounded-[9999px] border border-primary bg-primary px-5 py-3 text-xs font-bold tracking-widest text-on-primary uppercase transition-[background-color,transform] hover:bg-primary/90 focus-visible:outline-offset-4 active:translate-y-px"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex min-h-11 items-center rounded-[9999px] border border-outline px-5 py-3 text-xs font-bold tracking-widest text-on-surface uppercase transition-[background-color,transform] hover:bg-surface-container active:translate-y-px"
        >
          Reload
        </button>
      </div>
    </div>
  );
}
