"use client";

import { Shuffle } from "lucide-react";

interface TvAutoplayerButtonProps {
  count: number;
  disciplineLabel: string;
  categoryLabel?: string | null;
  disabled?: boolean;
  onOpen: () => void;
}

export function TvAutoplayerButton({
  count,
  disciplineLabel,
  categoryLabel,
  disabled,
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
          ? `Shuffle unavailable — ${disabledReason}`
          : `Shuffle ${queueLabel}`
      }
      title={disabledReason ?? `Shuffle ${queueLabel}`}
      className={`inline-flex h-control w-control shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-control border font-display text-xs font-bold uppercase tracking-pill transition-[background-color,transform] duration-150 ease-out active:translate-y-px focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:px-5 ${
        count === 0
          ? "border-wire-border-strong bg-transparent text-wire-muted"
          : "border-on-wire bg-on-wire text-wire hover:bg-on-wire/90"
      }`}
    >
      <Shuffle size={16} aria-hidden="true" />
      <span className="hidden sm:inline">Shuffle</span>
    </button>
  );
}
