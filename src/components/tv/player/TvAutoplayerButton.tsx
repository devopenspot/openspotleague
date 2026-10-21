"use client";

import { Play, Tv } from "lucide-react";

interface TvAutoplayerButtonProps {
  count: number;
  disciplineLabel: string;
  categoryLabel?: string | null;
  disabled?: boolean;
  fullWidth?: boolean;
  onOpen: () => void;
}

export function TvAutoplayerButton({
  count,
  disciplineLabel,
  categoryLabel,
  disabled,
  fullWidth,
  onOpen,
}: TvAutoplayerButtonProps) {
  const isAll =
    disciplineLabel.toLowerCase() === "all sports" ||
    disciplineLabel.toLowerCase() === "all";
  const isAllCategory = !categoryLabel || categoryLabel.toLowerCase() === "all";
  const queueLabel = isAllCategory
    ? isAll
      ? "All sports"
      : disciplineLabel
    : `${disciplineLabel} · ${categoryLabel}`;

  const disabledReason = count === 0 ? "No videos for this filter" : undefined;

  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={disabled || count === 0}
      aria-label={
        count === 0
          ? `Autoplay unavailable — ${disabledReason}`
          : `Autoplay ${queueLabel}`
      }
      title={disabledReason ?? `Play ${queueLabel}`}
      className={`inline-flex shrink-0 items-center gap-1.5 sm:gap-2 whitespace-nowrap rounded-full px-3 sm:px-4 py-1.5 sm:py-2 font-display text-[10px] sm:text-[11px] font-bold uppercase tracking-wide sm:tracking-widest shadow-sm transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${
        fullWidth
          ? "w-full justify-center sm:w-auto"
          : "max-w-[52vw] sm:max-w-none"
      } ${
        count === 0
          ? "border border-white/15 bg-white/10 text-white/60"
          : "bg-white text-black hover:bg-white/90"
      }`}
    >
      <span className="hidden sm:inline-flex shrink-0 items-center justify-center rounded-full bg-black/10 p-1">
        <Tv size={12} aria-hidden="true" />
      </span>
      <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-black text-white p-1">
        <Play size={11} className="ml-[1px] sm:h-3 sm:w-3" aria-hidden="true" />
      </span>
      <span className="hidden sm:inline shrink-0">Autoplay</span>
      <span className="sm:hidden shrink-0">Play</span>
      <span
        aria-hidden="true"
        className="hidden h-3 w-px shrink-0 bg-black/15 sm:block"
      />
      <span className="min-w-0 max-w-[12ch] sm:max-w-[16ch] truncate">
        {queueLabel}
      </span>
    </button>
  );
}
