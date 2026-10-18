"use client";

import Image from "next/image";
import { memo, useState } from "react";
import { Tv } from "lucide-react";
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
      sizes="232px"
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
      className={`group/card flex w-[208px] shrink-0 flex-col overflow-hidden rounded-[14px] border bg-wire-border text-left transition-colors duration-150 ease-out hover:border-wire-border-strong hover:bg-wire-border-strong hover:shadow-md hover:-translate-y-px active:translate-y-0 active:bg-wire-border-strong active:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-wire sm:w-[232px] ${
        active ? "border-on-wire" : "border-wire-border"
      }`}
    >
      <div className="relative h-[32vh] w-full overflow-hidden bg-wire-border flex items-center justify-center">
        <CardImage item={item} />
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-on-surface/45 via-transparent to-transparent opacity-60"
        />
        <span className="absolute left-0 top-0 inline-flex items-center gap-1 rounded-br rounded-tl border border-white/15 bg-on-surface/55 px-2 py-1 font-display text-[9px] font-bold uppercase tracking-[0.08em] leading-none text-surface shadow-sm backdrop-blur-md">
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-white"
            aria-hidden="true"
          />
          <span className="truncate max-w-[12ch]">{item.disciplineSlug}</span>
        </span>

        <span className="absolute right-0 top-0 inline-flex max-w-full items-center justify-start truncate rounded-bl rounded-tr border border-white/15 bg-on-surface/55 px-2 py-1 font-display text-[9px] font-bold uppercase tracking-[0.08em] leading-none text-surface shadow-sm backdrop-blur-md sm:max-w-[150px]">
          {item.meta}
        </span>

        <p className="absolute bottom-0 left-0 max-w-[calc(100%-12px)] truncate rounded-tr rounded-bl border border-white/15 bg-on-surface/55 px-2 py-1 font-display text-[9px] font-bold uppercase tracking-[0.08em] leading-none text-surface shadow-sm backdrop-blur-md">
          {item.title}
        </p>
      </div>
    </button>
  );
});
