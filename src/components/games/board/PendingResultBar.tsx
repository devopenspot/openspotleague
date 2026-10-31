"use client";

import { Undo2 } from "lucide-react";
import type { PendingResult } from "@/components/games/hooks/usePendingResult";

export function pendingResultStatus(pending: PendingResult) {
  if (pending.status === "unsent") return "No signal — result saved";
  if (pending.status === "sending") return "Sending…";
  return pending.result === "landed" ? "Marked as Landed" : "Marked as Failed";
}

const BASE =
  "relative inline-flex min-w-0 flex-1 items-center justify-center gap-2 overflow-hidden rounded-lg px-3 font-display font-bold uppercase leading-tight tracking-[0.04em] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 active:translate-y-px disabled:cursor-wait";
const SECONDARY =
  "border-[3px] border-on-surface bg-surface-container-lowest text-on-surface";
const PRIMARY = "border-2 border-primary bg-primary text-on-primary";

/** Replaces the result buttons from the tap until the server has the result. */
export function PendingResultBar({
  pending,
  size,
  onUndo,
  onResend,
}: {
  pending: PendingResult;
  size: "sheet" | "inline";
  onUndo: () => void;
  onResend: () => void;
}) {
  const sizing =
    size === "sheet" ? "min-h-[72px] text-lg" : "min-h-12 text-sm md:flex-none md:px-6";

  if (pending.status === "unsent") {
    return (
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onUndo}
          className={`${BASE} ${SECONDARY} ${sizing}`}
        >
          Discard
        </button>
        <button
          type="button"
          onClick={onResend}
          className={`${BASE} ${PRIMARY} ${sizing}`}
        >
          Send Again
        </button>
      </div>
    );
  }

  if (pending.status === "sending") {
    return (
      <div className="flex">
        <button
          type="button"
          disabled
          className={`${BASE} ${SECONDARY} ${sizing}`}
        >
          Sending…
        </button>
      </div>
    );
  }

  return (
    <div className="flex">
      <button
        type="button"
        onClick={onUndo}
        aria-label={`Undo ${pending.result}`}
        className={`${BASE} ${SECONDARY} ${sizing}`}
      >
        <span
          aria-hidden="true"
          className="absolute inset-0 origin-left bg-surface-container-highest motion-safe:animate-[undo-countdown_linear_forwards]"
          style={{ animationDuration: `${pending.undoMs}ms` }}
        />
        <span className="relative inline-flex items-center gap-2">
          <Undo2 size={24} strokeWidth={2.75} aria-hidden="true" />
          Undo
        </span>
      </button>
    </div>
  );
}
