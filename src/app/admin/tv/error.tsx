"use client";

import { useEffect } from "react";
import Link from "next/link";
import { log } from "@/lib/utils/log";

export default function AdminTvError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    log.error("admin.tv.error_boundary", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  const message = (error.message || "").toLowerCase();
  const isAuthError =
    message.includes("unauthenticated") ||
    message.includes("not signed in") ||
    message.includes("jwt expired") ||
    message.includes("session");

  return (
    <section
      className="space-y-4 rounded-lg border border-outline-variant bg-surface-container-lowest p-6"
      role="alert"
    >
      <p className="font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
        {isAuthError ? "Session Expired" : "TV Catalogue Unavailable"}
      </p>
      <h1 className="font-display text-2xl font-bold tracking-tight text-on-surface">
        {isAuthError ? "Authentication required" : "Could not load TV videos"}
      </h1>
      <p className="max-w-xl text-sm leading-6 text-on-surface-variant">
        {isAuthError
          ? "Your session expired after being idle. Reload to refresh or sign in again to continue."
          : "The database or network request did not finish. Check the connection and try again; no changes were made."}
        {error.digest ? ` Ref: ${error.digest.slice(0, 8)}` : ""}
      </p>
      <div className="flex flex-wrap items-center gap-2 pt-2">
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-primary bg-primary px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-on-primary transition-colors duration-150 ease-out hover:bg-surface-tint active:scale-[0.99]"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-outline px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-on-surface transition-colors duration-150 ease-out hover:bg-surface-container-low active:scale-[0.99]"
        >
          Reload page
        </button>
        {isAuthError && (
          <Link
            href="/login?next=%2Fadmin%2Ftv"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-outline px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-primary transition-colors duration-150 ease-out hover:bg-surface-container-low active:scale-[0.99]"
          >
            Sign in again
          </Link>
        )}
      </div>
    </section>
  );
}
