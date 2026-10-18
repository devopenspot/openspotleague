"use client";

import { useState } from "react";
import { Copy, Link as LinkIcon, QrCode, Share2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { showToast } from "@/hooks/ui/useToast";
import { copyText, shareOrCopyUrl } from "@/lib/utils/share";
import { cn } from "@/lib/utils/cn";

export function ShareActions({
  url,
  code,
  title = "Share Open Spot",
  className,
  showShare = true,
  compact = false,
}: {
  url: string;
  code?: string;
  title?: string;
  className?: string;
  showShare?: boolean;
  compact?: boolean;
}) {
  const [showQr, setShowQr] = useState(false);
  const resolvedUrl = resolveShareUrl(url);

  async function handleCopy(value: string, message: string) {
    if (await copyText(value)) showToast(message, "success");
    else showToast("Could not copy. Select the value manually.", "error");
  }

  async function handleShare() {
    const result = await shareOrCopyUrl(resolvedUrl, title);
    if (result === "shared") showToast("Share sheet opened.", "success");
    else if (result === "copied") showToast("Link copied.", "success");
    else showToast("Could not share this link.", "error");
  }

  const buttonClass = compact
    ? "inline-flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-[16px] border border-outline bg-surface-container-high px-2 py-2 font-display text-xs font-bold uppercase leading-tight tracking-[0.05em] text-on-surface transition-colors hover:bg-surface-container-highest focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
    : "inline-flex min-h-11 items-center gap-2 rounded-full border border-outline bg-surface-container-high px-3 font-display text-xs font-bold uppercase tracking-[0.05em] text-on-surface transition-colors hover:bg-surface-container-highest focus-visible:outline-offset-4";

  return (
    <div
      className={cn(
        compact ? "grid grid-cols-3 gap-2" : "flex flex-wrap items-center gap-2",
        className,
      )}
    >
      {showShare ? (
        <button
          type="button"
          onClick={() => void handleShare()}
          className={cn(buttonClass, "border-on-surface")}
        >
          <Share2 size={14} aria-hidden="true" /> Share
        </button>
      ) : null}

      {code ? (
        <button
          type="button"
          onClick={() => void handleCopy(code, "Code copied.")}
          className={buttonClass}
        >
          <Copy size={14} aria-hidden="true" /> Copy code
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => void handleCopy(resolvedUrl, "Link copied.")}
        className={buttonClass}
      >
        <LinkIcon size={14} aria-hidden="true" /> Copy link
      </button>
      <button
        type="button"
        aria-expanded={showQr}
        onClick={() => setShowQr((open) => !open)}
        className={buttonClass}
      >
        <QrCode size={14} aria-hidden="true" /> QR code
      </button>
      {showQr ? (
        <div
          className={cn(
            "rounded-[16px] border border-outline-variant bg-surface-bright",
            compact ? "col-span-3 flex justify-center p-2" : "basis-full p-4",
          )}
          aria-label="QR code for shared link"
        >
          <QRCodeSVG
            value={resolvedUrl}
            size={compact ? 128 : 160}
            bgColor="var(--color-surface-container-lowest)"
            fgColor="var(--color-on-surface)"
            level="M"
          />
        </div>
      ) : null}
    </div>
  );
}

function resolveShareUrl(url: string) {
  if (typeof window === "undefined") return url;
  return new URL(url, window.location.origin).toString();
}
