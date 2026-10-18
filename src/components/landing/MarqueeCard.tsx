"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { MapPinned, Tv, CalendarDays } from "lucide-react";
import type { MarqueeItem } from "./marquee-data";

function kindLabel(kind: string) {
  if (kind === "spot") return "Spot";
  if (kind === "event") return "Event";
  return "TV";
}

function kindIcon(kind: string, size = 10) {
  if (kind === "spot") return <MapPinned size={size} aria-hidden="true" />;
  if (kind === "event") return <CalendarDays size={size} aria-hidden="true" />;
  return <Tv size={size} aria-hidden="true" />;
}

function dummyStyle(kind: string): React.CSSProperties {
  if (kind === "spot") {
    return {
      backgroundImage:
        "repeating-linear-gradient(135deg, color-mix(in srgb, var(--color-on-wire) 18%, transparent) 0 8px, transparent 8px 14px)",
    };
  }
  if (kind === "event") {
    return {
      backgroundImage:
        "radial-gradient(circle at 2px 2px, color-mix(in srgb, var(--color-on-wire) 28%, transparent) 1.2px, transparent 1.2px)",
      backgroundSize: "10px 10px",
    };
  }
  return {
    backgroundImage:
      "linear-gradient(color-mix(in srgb, var(--color-on-wire) 18%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--color-on-wire) 14%, transparent) 1px, transparent 1px)",
    backgroundSize: "14px 14px",
  };
}

function CardImage({ item }: { item: MarqueeItem }) {
  const [failed, setFailed] = useState(false);
  const showFallback = !item.imageUrl || failed;

  if (showFallback) {
    return (
      <div
        aria-hidden="true"
        className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-wire-border px-2 text-wire-muted"
        style={dummyStyle(item.kind)}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-wire-border-strong bg-wire-border-strong text-on-wire shadow-sm">
          {kindIcon(item.kind, 14)}
        </span>
        <span className="font-display text-[9px] font-bold uppercase tracking-[0.08em] leading-none text-wire-muted">
          {kindLabel(item.kind)}
        </span>
      </div>
    );
  }

  return (
    <Image
      src={item.imageUrl!}
      alt=""
      fill
      sizes="232px"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="object-cover transition-transform duration-300 motion-safe:group-hover/card:scale-[1.02]"
    />
  );
}

export function MarqueeCard({ item }: { item: MarqueeItem }) {
  return (
    <Link
      href={item.href}
      aria-label={`${kindLabel(item.kind)}: ${item.title} — ${item.meta}`}
      className="group/card flex w-[208px] shrink-0 flex-col overflow-hidden rounded-[14px] border border-wire-border bg-wire-border text-left transition-colors duration-150 ease-out hover:border-wire-border-strong hover:bg-wire-border-strong hover:shadow-md hover:-translate-y-px active:translate-y-0 active:bg-wire-border-strong active:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-wire sm:w-[232px]"
    >
      <div className="relative h-[32vh] w-full overflow-hidden bg-wire-border flex items-center justify-center">
        <CardImage item={item} />
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-on-surface/45 via-transparent to-transparent opacity-60"
        />
        <span className="absolute left-0 top-0 inline-flex items-center gap-1 rounded-br rounded-tl border border-white/15 bg-on-surface/55 px-2 py-1 font-display text-[9px] font-bold uppercase tracking-[0.08em] leading-none text-surface shadow-sm backdrop-blur-md">
          {kindIcon(item.kind)}
          <span>{kindLabel(item.kind)}</span>
        </span>

        <span className="absolute right-0 top-0 inline-flex max-w-full items-center justify-start truncate rounded-bl rounded-tr border border-white/15 bg-on-surface/55 px-2 py-1 font-display text-[9px] font-bold uppercase tracking-[0.08em] leading-none text-surface shadow-sm backdrop-blur-md sm:max-w-[150px]">
          {item.meta}
        </span>

        <p className="absolute bottom-0 left-0 max-w-[calc(100%-12px)] truncate rounded-tr rounded-bl border border-white/15 bg-on-surface/55 px-2 py-1 font-display text-[9px] font-bold uppercase tracking-[0.08em] leading-none text-surface shadow-sm backdrop-blur-md">
          {item.title}
        </p>
      </div>
    </Link>
  );
}
