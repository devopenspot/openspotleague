"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

const GENERIC_MESSAGES: readonly string[] = [
  "Centering The Map…",
  "Syncing The Spot Grid…",
  "Dropping The Pins…",
  "Almost There — Rolling In!",
] as const;

const CITY_TAIL_MESSAGES: readonly string[] = [
  "Dropping The Pins…",
  "Almost There — Rolling In!",
] as const;

function getMessages(cityName?: string | null): readonly string[] {
  if (!cityName) return GENERIC_MESSAGES;
  return [
    `Centering ${cityName} On The Map…`,
    `Loading ${cityName}'s Spots…`,
    ...CITY_TAIL_MESSAGES,
  ];
}

/**
 * City-scope loading cover for the map — copy of the games
 * `GameTransitionLoader` strategy (rotating message carousel, brand
 * mark, pulsing dots, reduced-motion static) with map-tailored copy.
 * Positioning is caller-owned via `className` so the same component
 * covers the map canvas (absolute overlay, Leaflet stays mounted) and
 * the search panel (inline block).
 */
export function MapCityLoader({
  isOpen,
  cityName,
  className,
}: {
  isOpen: boolean;
  /** Display name of the city being loaded; generic copy when absent. */
  cityName?: string | null;
  /** Full container classes (positioning + backdrop) supplied by the caller. */
  className?: string;
}) {
  const messages = useMemo(() => getMessages(cityName), [cityName]);
  const [index, setIndex] = useState(0);
  const reduced = useReducedMotion();
  const intervalRef = useRef<number | null>(null);

  // reset when the message set changes (scale-in on new city names)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset carousel when the city name changes
    setIndex(0);
  }, [messages]);

  useEffect(() => {
    if (!isOpen) return;
    if (reduced) return;
    intervalRef.current = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % messages.length);
    }, 1900);
    return () => {
      if (intervalRef.current !== null)
        window.clearInterval(intervalRef.current);
    };
  }, [isOpen, messages.length, reduced]);

  if (!isOpen) return null;

  const current = messages[index] ?? messages[0] ?? "";

  return (
    <div
      data-testid="map-city-loader"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading city spots"
      className={className}
    >
      {/* brand mark */}
      <div className="flex flex-col items-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-container-lowest shadow-sm sm:h-24 sm:w-24">
          <Image
            src="/logo.gif"
            alt=""
            width={80}
            height={80}
            className="h-16 w-16 object-contain sm:h-20 sm:w-20"
            aria-hidden="true"
          />
        </div>

        <p className="mt-6 font-display text-xs font-bold uppercase tracking-[0.14em] text-secondary">
          Hang Tight
        </p>

        <div className="relative mt-3 h-[2.6rem] w-full max-w-[22rem] sm:h-12 sm:max-w-[28rem]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.h2
              key={current}
              initial={reduced ? { opacity: 1 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? { opacity: 1 } : { opacity: 0, y: -8 }}
              transition={
                reduced
                  ? { duration: 0.01 }
                  : { duration: 0.28, ease: [0.16, 1, 0.3, 1] }
              }
              className="absolute inset-0 flex items-center justify-center text-center font-display text-2xl font-bold leading-none tracking-[-0.02em] text-on-surface sm:text-3xl"
            >
              {current}
            </motion.h2>
          </AnimatePresence>
        </div>

        <p className="mt-3 max-w-[20rem] text-center text-sm leading-5 text-on-surface-variant sm:max-w-[24rem]">
          Keep the map open — we’re syncing the city grid.
        </p>

        {/* dots — hidden when reduced motion to keep static */}
        <div className="mt-6 flex items-center gap-2" aria-hidden="true">
          <span className="h-1.5 w-1.5 rounded-full bg-primary motion-safe:animate-[pulseDot_1.4s_ease-in-out_infinite]" />
          <span className="h-1.5 w-1.5 rounded-full bg-primary/60 motion-safe:animate-[pulseDot_1.4s_ease-in-out_0.2s_infinite]" />
          <span className="h-1.5 w-1.5 rounded-full bg-primary/30 motion-safe:animate-[pulseDot_1.4s_ease-in-out_0.4s_infinite]" />
        </div>
      </div>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {current}
      </p>
    </div>
  );
}
