"use client";

import { reloadPage } from "@/lib/browser/detect-ios";
import { cn } from "@/lib/utils/cn";
import { alertClass, controlClass, EYEBROW } from "./recipes";

interface LocationBlockedCalloutProps {
  onRetry?: () => void;
  variant?: "inline" | "banner";
  /** `lg` keeps 48px targets for outdoor game sessions; `md` matches the shared 44px control. */
  size?: "md" | "lg";
  className?: string;
}

export function LocationBlockedCallout({
  onRetry,
  variant = "inline",
  size = "lg",
  className = "",
}: LocationBlockedCalloutProps) {
  const isBanner = variant === "banner";
  const sizeClass = size === "lg" ? "min-h-12 text-sm" : "";

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
      className={cn(
        alertClass("neutral"),
        isBanner && "flex flex-wrap items-center justify-between gap-3",
        className,
      )}
    >
      <div className="min-w-0 flex-[1_1_14rem]">
        <p className={EYEBROW}>Location blocked</p>
        <p className="mt-1 text-sm leading-5 text-on-surface-variant">
          Allow location in your browser settings, close this tab and open again, then tap Try again.
        </p>
      </div>
      <div className={cn("flex shrink-0 flex-wrap gap-2", !isBanner && "mt-3")}>
        <button type="button" onClick={handleRetry} className={cn(controlClass("primary"), sizeClass)}>
          Try again
        </button>
        <button type="button" onClick={handleRefresh} className={cn(controlClass("outline"), sizeClass)}>
          Refresh
        </button>
      </div>
    </div>
  );
}
