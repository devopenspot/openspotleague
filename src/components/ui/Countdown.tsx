"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";

export interface CountdownParts {
  totalSeconds: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function getCountdownParts(target: Date | string, now = new Date()): CountdownParts {
  const targetTime = target instanceof Date ? target.getTime() : Date.parse(target);
  const totalSeconds = Number.isFinite(targetTime) ? Math.max(0, Math.ceil((targetTime - now.getTime()) / 1000)) : 0;
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { totalSeconds, days, hours, minutes, seconds };
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function formatCountdown(parts: CountdownParts) {
  if (parts.totalSeconds <= 0) return "Now";
  if (parts.days > 0) return `${parts.days}d ${pad(parts.hours)}h ${pad(parts.minutes)}m`;
  return `${pad(parts.hours)}:${pad(parts.minutes)}:${pad(parts.seconds)}`;
}

export function Countdown({ target, label = "Countdown", className }: { target: Date | string; label?: string; className?: string }) {
  const [parts, setParts] = useState(() => getCountdownParts(target));

  useEffect(() => {
    const update = () => setParts(getCountdownParts(target));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [target]);

  return <time dateTime={target instanceof Date ? target.toISOString() : target} aria-label={`${label}: ${formatCountdown(parts)}`} className={cn("font-display text-xs font-bold tabular-nums", className)}>{formatCountdown(parts)}</time>;
}
