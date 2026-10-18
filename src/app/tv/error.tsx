"use client";

import { Tv } from "lucide-react";

export default function TvError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
        <button
          type="button"
          onClick={reset}
          className="mt-5 rounded-full bg-white px-5 py-2 font-display text-xs font-bold uppercase tracking-wider text-black transition-colors hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
