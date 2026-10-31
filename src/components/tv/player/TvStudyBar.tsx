"use client";

import { Gauge, Repeat, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  TV_BACK_SECONDS,
  TV_LOOP_SECONDS,
  type TvPlaybackRate,
} from "./tv-study";

function buttonClassName(active: boolean): string {
  return cn(
    "inline-flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-full border px-3 font-display text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:opacity-40 touch-manipulation sm:min-w-28",
    active
      ? "border-on-wire bg-on-wire text-black"
      : "border-wire-border-strong bg-wire-border text-on-wire hover:bg-wire-border-strong",
  );
}

/** Rider study tools: rewatch a move, slow it down, or repeat it. */
export function TvStudyBar({
  rate,
  looping,
  disabled = false,
  onBack,
  onCycleRate,
  onToggleLoop,
}: {
  rate: TvPlaybackRate;
  looping: boolean;
  disabled?: boolean;
  onBack: () => void;
  onCycleRate: () => void;
  onToggleLoop: () => void;
}) {
  return (
    <div
      role="group"
      aria-label="Study tools"
      className="grid shrink-0 grid-cols-3 gap-2 border-t border-wire-border bg-black px-3 py-2 landscape:hidden sm:flex sm:justify-center sm:px-4 sm:landscape:flex"
    >
      <button
        type="button"
        onClick={onBack}
        disabled={disabled}
        title="Shortcut: J"
        className={buttonClassName(false)}
      >
        <RotateCcw size={14} aria-hidden="true" />
        <span>Back {TV_BACK_SECONDS}s</span>
      </button>
      <button
        type="button"
        onClick={onCycleRate}
        disabled={disabled}
        aria-label={`Playback speed ${rate}x`}
        title="Shortcut: comma"
        className={buttonClassName(rate !== 1)}
      >
        <Gauge size={14} aria-hidden="true" />
        <span>{rate}x</span>
      </button>
      <button
        type="button"
        onClick={onToggleLoop}
        disabled={disabled}
        aria-pressed={looping}
        title="Shortcut: L"
        className={buttonClassName(looping)}
      >
        <Repeat size={14} aria-hidden="true" />
        <span>Loop {TV_LOOP_SECONDS}s</span>
      </button>
    </div>
  );
}
