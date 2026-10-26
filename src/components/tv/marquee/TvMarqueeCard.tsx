"use client";

import Image from "next/image";
import { memo, useState } from "react";
import { Tv } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { TvCard } from "@/types/tv";
import type { TvMarqueeItem } from "./tv-marquee-data";

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
}: {
  item: TvMarqueeItem;
  active?: boolean;
  onSelect: (video: TvCard) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item.video)}
      aria-label={`${item.title} — ${item.disciplineSlug} · ${item.meta}`}
      className={cn(
        "group/card flex w-[240px] sm:w-[270px] shrink-0 flex-col overflow-hidden rounded-[14px] border text-left transition-all duration-150 ease-out hover:border-wire-border-strong hover:bg-wire-border-strong hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-wire",
        active ? "border-on-wire bg-wire-border" : "border-wire-border bg-wire",
      )}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-wire-border flex items-center justify-center">
        <CardImage item={item} />
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-40 group-hover/card:opacity-20 transition-opacity"
        />
        <span className="absolute left-0 top-0 inline-flex items-center gap-1 rounded-tl rounded-br border border-white/15 bg-black/60 px-2 py-0.5 font-display text-[9px] font-bold uppercase tracking-wider text-white shadow-sm backdrop-blur-md">
          <span className="truncate max-w-[12ch]">{item.meta}</span>
        </span>
        <span className="absolute right-0 top-0 inline-flex items-center gap-1 rounded-bl rounded-tr border border-white/15 bg-black/60 px-2 py-0.5 font-display text-[9px] font-bold uppercase tracking-wider text-white shadow-sm backdrop-blur-md">
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-white"
            aria-hidden="true"
          />
          <span className="truncate max-w-[12ch]">{item.disciplineSlug}</span>
        </span>
      </div>

      <div className="flex flex-col gap-1 p-2.5 sm:p-3 min-w-0">
        <p className="line-clamp-2 text-xs sm:text-sm font-semibold leading-snug text-white transition-colors group-hover/card:text-white/90">
          {item.title}
        </p>
      </div>
    </button>
  );
});
