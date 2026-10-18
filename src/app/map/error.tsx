"use client";
import { useEffect } from "react";
import { log } from "@/lib/utils/log";
export default function MapError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    log.error("Map segment error", { digest: error.digest, message: error.message } as unknown as never);
  }, [error]);
  return (
    <div role="alert" className="mx-auto my-8 max-w-md rounded-[16px] border bg-surface-bright p-6 text-center">
      <h2 className="font-display text-sm font-bold uppercase">Map is off the grid</h2>
      <p className="mt-2 text-xs text-secondary">{error.message || "Map threw while rendering. Try again."}</p>
      <button type="button" onClick={reset} className="mt-4 min-h-11 rounded-full bg-on-surface px-5 text-xs font-bold uppercase text-surface">
        Try again
      </button>
    </div>
  );
}
