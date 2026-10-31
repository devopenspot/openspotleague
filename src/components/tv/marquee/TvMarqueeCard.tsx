"use client";

import Image from "next/image";
import { memo, useState } from "react";
import { Tv } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { TvCard } from "@/types/tv";
import type { TvMarqueeItem } from "./tv-marquee-data";
import { TvBrandMark } from "./TvBrandMark";

function CardImage({ item }: { item: TvMarqueeItem }) {
  const [failed, setFailed] = useState(false);
  const showFallback = !item.thumb || failed;

  if (showFallback) {
    return (
      <div
        aria-hidden="true"
        className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-wire-border px-2 text-wire-muted"
        style={{
          backgroundImage:
            "linear-gradient(color-mix(in srgb, var(--color-on-wire) 18%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--color-on-wire) 14%, transparent) 1px, transparent 1px)",
          backgroundSize: "14px 14px",
        }}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-wire-border-strong bg-wire-border-strong text-on-wire shadow-sm">
          <Tv size={14} aria-hidden="true" />
        </span>
        <span className="font-display text-[9px] font-bold uppercase tracking-[0.08em] leading-none text-wire-muted">
          TV
        </span>
      </div>
    );
  }

  return (
    <Image
      src={item.thumb!}
      alt=""
      fill
      sizes="(min-width: 640px) 270px, 240px"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="object-cover transition-transform duration-300 motion-safe:group-hover/card:scale-[1.02]"
    />
  );
}

export const TvMarqueeCard = memo(function TvMarqueeCard({
  item,
  active,
  onSelect,
  fluid = false,
  progress,
}: {
  item: TvMarqueeItem;
  active?: boolean;
  onSelect: (video: TvCard) => void;
  /** Fill the parent (search grid) instead of the fixed row width. */
  fluid?: boolean;
  /** Watched fraction (0-1); only the Continue watching shelf passes it. */
  progress?: number;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item.video)}
      aria-label={`${item.title} — ${item.disciplineLabel} · ${item.meta}`}
      className={cn(
        "group/card flex shrink-0 flex-col gap-2 text-left focus-visible:outline-none",
        fluid ? "w-full" : "w-[240px] sm:w-[270px]",
      )}
    >
      <div
        className={cn(
          "relative aspect-video w-full overflow-hidden rounded-md bg-wire-border transition-[box-shadow,transform] duration-150 ease-out group-active/card:scale-[0.99] group-focus-visible/card:ring-2 group-focus-visible/card:ring-white group-focus-visible/card:ring-offset-2 group-focus-visible/card:ring-offset-wire",
          active && "ring-2 ring-on-wire",
        )}
      >
        <CardImage item={item} />
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent"
        />
        <span className="absolute inline-flex items-center rounded-bl-0 rounded-br bg-white px-1.5 py-[3px] font-display text-[10px] font-bold uppercase leading-none tracking-wide text-black">
          <span className="truncate max-w-[14ch]">
            {item.isNew ? "New" : item.disciplineSlug}
          </span>
        </span>
        <TvBrandMark />
        {progress !== undefined ? (
          <span
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-1 bg-wire-border-strong"
          >
            <span
              className="block h-full bg-on-wire"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </span>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-col gap-0.5 px-0.5">
        <p className="line-clamp-2 text-[13px] sm:text-sm font-medium leading-snug text-white/90 transition-colors group-hover/card:text-white">
          {item.title}
        </p>
        <p className="truncate text-xs text-white/50">
          {item.isNew ? `${item.disciplineLabel} · ${item.meta}` : item.meta}
        </p>
      </div>
    </button>
  );
});
