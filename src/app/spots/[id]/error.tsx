"use client";
import { useEffect } from "react";
import { log } from "@/lib/utils/log";
import Link from "next/link";
export default function SpotError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    log.error("Spot segment error", { digest: error.digest, message: error.message } as unknown as never);
  }, [error]);
  return (
    <div role="alert" className="mx-auto my-12 max-w-md rounded-[16px] border border-outline-variant bg-surface-bright p-6 text-center">
      <h2 className="font-display text-base font-bold uppercase">Spot unavailable</h2>
      <p className="mt-2 text-xs leading-relaxed text-secondary">{error.message || "This spot threw while rendering."} {error.digest ? `· Ref ${error.digest.slice(0, 8)}` : ""}</p>
      <div className="mt-5 flex justify-center gap-2">
        <button type="button" onClick={reset} className="min-h-11 rounded-full bg-on-surface px-4 text-xs font-bold uppercase text-surface">
          Try again
        </button>
        <Link href="/explore" className="min-h-11 rounded-full border border-outline px-4 text-xs font-bold uppercase flex items-center">
          Back to directory
        </Link>
      </div>
    </div>
  );
}
