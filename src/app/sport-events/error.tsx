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
    log.error("Sport events route error", error);
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
      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex min-h-11 items-center rounded-[9999px] border border-primary bg-primary px-5 py-3 text-xs font-bold tracking-widest text-on-primary uppercase transition-[background-color,transform] hover:bg-primary/90 focus-visible:outline-offset-4 active:translate-y-px"
      >
        Try again
      </button>
    </div>
  );
}
