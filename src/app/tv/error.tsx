"use client";

import { useEffect } from "react";
import { Tv } from "lucide-react";
import { controlClass, PANEL_ON_WIRE } from "@/components/ui/recipes";

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
    <div className="flex min-h-[60dvh] flex-col items-center justify-center px-5 py-12 text-center text-on-wire">
      <div className={`${PANEL_ON_WIRE} w-full max-w-md p-6 sm:p-8`}>
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
            className={controlClass("onWire")}
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className={controlClass("onWireOutline")}
          >
            Reload
          </button>
        </div>
      </div>
    </div>
  );
}
