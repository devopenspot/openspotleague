"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

type Variant = "creating" | "loading";

const CREATING_TRAINING: readonly string[] = [
  "Locking In Your Line…",
  "Warming Up The Session…",
  "Syncing Your Tricks…",
  "Almost There — Drop In!",
] as const;

const CREATING_CHALLENGE: readonly string[] = [
  "Opening The Lobby…",
  "Checking The Spot…",
  "Gathering The Crew…",
  "Almost Ready — Invite!",
] as const;

const LOADING: readonly string[] = [
  "Loading Your Session…",
  "Syncing The Board…",
  "Bringing The Crew…",
  "Checking You In…",
] as const;

function getMessages(variant: Variant, mode?: string): readonly string[] {
  if (variant === "loading") return LOADING;
  return mode === "challenge" ? CREATING_CHALLENGE : CREATING_TRAINING;
}

export function GameTransitionLoader({
  isOpen,
  variant = "loading",
  mode,
}: {
  isOpen: boolean;
  variant?: Variant;
  mode?: "training" | "challenge" | string;
}) {
  const messages = getMessages(variant, mode);
  const [index, setIndex] = useState(0);
  const reduced = useReducedMotion();
  const intervalRef = useRef<number | null>(null);

  // reset when variant/mode changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset carousel on variant switch
    setIndex(0);
  }, [variant, mode]);

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
      data-testid="game-transition-loader"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading game"
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-white/95 px-6 py-10 backdrop-blur-[2px]"
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
          Keep the app open — we’re syncing the crew.
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
