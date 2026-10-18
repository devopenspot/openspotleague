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
          ? `flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-primary/20 bg-primary/10 px-3 py-3 text-xs leading-5 ${className}`
          : `rounded-[16px] border border-primary/20 bg-primary/10 px-3 py-3 text-xs leading-5 ${className}`
      }
    >
      <div className="min-w-0 flex-1">
        <p className="font-display text-xs font-bold uppercase tracking-wide text-primary">
          Location blocked
        </p>
        <p className="mt-1 text-secondary">
          Allow location in your browser settings, close this tab and open again, then tap Try again.
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <button
          type="button"
          onClick={handleRetry}
          className="min-h-11 rounded-full border border-primary bg-primary px-4 font-display text-[10px] font-bold uppercase tracking-widest text-on-primary hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={handleRefresh}
          className="min-h-11 rounded-full border border-outline-variant bg-surface px-4 font-display text-[10px] font-bold uppercase tracking-widest text-on-surface hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
