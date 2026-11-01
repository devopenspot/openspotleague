"use client";

import { reloadPage } from "@/lib/browser/detect-ios";

interface LocationBlockedCalloutProps {
  onRetry?: () => void;
  variant?: "inline" | "banner";
  className?: string;
}

export function LocationBlockedCallout({
  onRetry,
  variant = "inline",
  className = "",
}: LocationBlockedCalloutProps) {
  const isBanner = variant === "banner";

  const handleRetry = () => {
    if (onRetry) void onRetry();
  };

  const handleRefresh = () => {
    reloadPage();
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={
        isBanner
          ? `flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-primary/20 bg-primary/10 p-4 ${className}`
          : `rounded-lg border-2 border-primary/20 bg-primary/10 p-4 ${className}`
      }
    >
      <div className="min-w-0 flex-[1_1_14rem]">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.05em] text-primary">
          Location blocked
        </p>
        <p className="mt-1 text-sm font-semibold leading-5 text-secondary">
          Allow location in your browser settings, close this tab and open again, then tap Try again.
        </p>
      </div>
      <div className={`flex shrink-0 flex-wrap gap-2 ${isBanner ? "" : "mt-3"}`}>
        <button
          type="button"
          onClick={handleRetry}
          className="min-h-12 rounded-lg border-2 border-primary bg-primary px-4 font-display text-sm font-bold uppercase tracking-[0.04em] text-on-primary transition-[background-color,transform] hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:translate-y-px"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={handleRefresh}
          className="min-h-12 rounded-lg border-2 border-outline-variant bg-surface px-4 font-display text-sm font-bold uppercase tracking-[0.04em] text-on-surface transition-[background-color,transform] hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:translate-y-px"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
