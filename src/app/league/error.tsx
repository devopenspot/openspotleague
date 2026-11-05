"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";
import { log } from "@/lib/utils/log";
import {
  BODY,
  CARD,
  CARD_TITLE,
  controlClass,
  pageContainer,
} from "@/components/ui/recipes";

export default function LeagueError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    try {
      log.error("League route error", error);
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
      const key = `osp_league_chunk_reload_${error.digest || error.message}`;
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        window.location.reload();
      }
    }
  }, [error]);

  return (
    <div className={pageContainer("7xl")}>
      <div
        role="alert"
        className={`${CARD} mx-auto my-6 max-w-md text-center sm:p-6`}
      >
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-control border border-outline-variant bg-surface-container-high text-error">
          <AlertTriangle size={20} aria-hidden="true" />
        </div>
        <h2 className={`${CARD_TITLE} text-on-surface`}>
          The league is temporarily unavailable
        </h2>
        <p className={`${BODY} mt-2`}>
          We could not load this page. Try again without leaving it.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className={controlClass("primary")}
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className={controlClass("outline")}
          >
            Reload
          </button>
        </div>
      </div>
    </div>
  );
}
