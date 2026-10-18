"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Pause, Share2, X, Zap } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Overlay } from "@/components/feedback/Overlay";
import { useKeyboardShortcuts } from "@/hooks/ui/useKeyboardShortcuts";
import { showToast } from "@/hooks/ui/useToast";
import { toAutoplayEmbedUrl } from "@/lib/tv/embed";
import { buildTvShareUrl } from "@/lib/tv/share";
import { shareOrCopyUrl } from "@/lib/utils/share";
import type { TvCard, TvCategory } from "@/types/tv";
import { TvQueueStrip } from "./TvQueueStrip";
import { TvCategoryPills, type TheaterCategory } from "./TvCategoryPills";

interface TvPlayerModalProps {
  isOpen: boolean;
  video: TvCard | null;
  total: number;
  disciplineLabel: string;
  categoryLabel: string | null;
  hasPrev: boolean;
  hasNext: boolean;
  autoplay: boolean;
  autoAdvance: boolean;
  onToggleAutoAdvance: () => void;
  /** Sound on by default — persisted in TvGrid */
  muted: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onEnded?: () => void;
  fallbackThumb?: string | null;
  fallbackTitle?: string | null;
  /** Queue for the bottom strip — falls back to [video] when omitted */
  queue?: readonly TvCard[];
  activeId?: string | null;
  onSelectVideo?: (id: string) => void;
  /** In-dialog category filter options (non-empty categories of the queue) */
  theaterCategories?: readonly { category: TvCategory; count: number }[];
  theaterCategory?: TheaterCategory;
  onSelectTheaterCategory?: (category: TheaterCategory) => void;
  /** Lazy loading support for the queue strip */
  hasMoreQueue?: boolean;
  isLoadingQueue?: boolean;
  onLoadMoreQueue?: () => void;
}

// Close delay matches the fade/scale exit animation below
const CLOSE_DELAY_MS = 200;
// Swipe-to-navigate thresholds (mobile stage swipe)
const SWIPE_MIN_DX = 48;
const SWIPE_AXIS_RATIO = 1.5;
// Guard against YouTube onStateChange double-firing on seek/replay
const ENDED_DEBOUNCE_MS = 1000;

export function TvPlayerModal({
  isOpen,
  video,
  total,
  disciplineLabel,
  categoryLabel,
  hasPrev,
  hasNext,
  autoplay,
  autoAdvance,
  onToggleAutoAdvance,
  muted,
  onClose,
  onPrev,
  onNext,
  onEnded,
  fallbackThumb,
  fallbackTitle,
  queue,
  activeId,
  onSelectVideo,
  theaterCategories,
  theaterCategory,
  onSelectTheaterCategory,
  hasMoreQueue,
  isLoadingQueue,
  onLoadMoreQueue,
}: TvPlayerModalProps) {
  const titleId = useId();
  const descId = useId();
  const reduced = useReducedMotion();
  const [isClosing, setIsClosing] = useState(false);

  const theaterRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastEndedAtRef = useRef(0);
  const closeTimerRef = useRef<number | null>(null);

  const handlePrev = useCallback(() => {
    if (hasPrev) onPrev();
  }, [hasPrev, onPrev]);

  const handleNext = useCallback(() => {
    if (hasNext) onNext();
  }, [hasNext, onNext]);

  const displayOpen = isOpen || isClosing;

  const shortcuts = useMemo(
    () =>
      displayOpen && !isClosing
        ? [
            { key: "ArrowLeft", handler: handlePrev },
            { key: "ArrowRight", handler: handleNext },
          ]
        : [],
    [displayOpen, isClosing, handlePrev, handleNext],
  );
  useKeyboardShortcuts(shortcuts);

  // YouTube iframe API postMessage ended detection (state 0 = ended)
  // Performance: only listens when autoAdvance is ON; filters by origin + JSON shape.
  useEffect(() => {
    if (!displayOpen || !video || !onEnded || !autoAdvance || isClosing) return;
    const handler = (event: MessageEvent) => {
      // Restrict to YouTube origins to avoid processing every postMessage in the app
      if (
        event.origin &&
        !event.origin.includes("youtube") &&
        !event.origin.includes("youtu.be")
      )
        return;
      if (typeof event.data !== "string") return;
      // Pre-filter: YouTube ended states contain either playerState":0 or onStateChange with 0 or info":0
      const mightBeEnded =
        event.data.includes('"playerState":0') ||
        (event.data.includes('"onStateChange"') && event.data.includes("0")) ||
        event.data.includes('"info":0');
      if (!mightBeEnded) return;
      try {
        const data = JSON.parse(event.data);
        // YT player emits onStateChange with info=0 or infoDelivery with playerState=0 when ended
        const isEnded =
          (data.event === "onStateChange" &&
            (data.info === 0 || data.info?.playerState === 0)) ||
          (data.event === "infoDelivery" &&
            data.info &&
            (data.info.playerState === 0 || data.info === 0));

        if (isEnded) {
          const now = Date.now();
          if (now - lastEndedAtRef.current < ENDED_DEBOUNCE_MS) return;
          lastEndedAtRef.current = now;
          onEnded();
        }
      } catch {
        // ignore non-JSON messages
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [displayOpen, video, onEnded, autoAdvance, isClosing]);

  const handleRequestClose = useCallback(() => {
    if (isClosing) return;
    if (reduced) {
      onClose();
      return;
    }
    setIsClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, CLOSE_DELAY_MS);
  }, [isClosing, reduced, onClose]);

  // Clear a pending close timer on unmount
  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);


  // Canonical share link (/tv?play=<id>) — native sheet on mobile,
  // clipboard copy on desktop. Built at click time so SSR never needs
  // window.location.origin.
  const handleShare = useCallback(async () => {
    if (!video) return;
    const url = buildTvShareUrl(video.id, window.location.origin);
    const result = await shareOrCopyUrl(url, video.title);
    if (result === "shared") showToast("Share sheet opened.", "success");
    else if (result === "copied") showToast("Link copied.", "success");
    else showToast("Could not share this link.", "error");
  }, [video]);

  // Mobile swipe: horizontal swipe on the stage navigates prev/next.
  // Attached to the stage wrapper (outside the iframe — touches over the
  // YouTube iframe itself never bubble). Vertical scroll is preserved via pan-y.
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const start = touchStartRef.current;
      touchStartRef.current = null;
      if (!start || isClosing) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      if (
        Math.abs(dx) > SWIPE_MIN_DX &&
        Math.abs(dx) > Math.abs(dy) * SWIPE_AXIS_RATIO
      ) {
        if (dx < 0) handleNext();
        else handlePrev();
      }
    },
    [handleNext, handlePrev, isClosing],
  );

  // Stable theater src: always enablejsapi for ended detection + mute commands
  // (avoids reload when toggling autoAdvance). Rebuilds only on video/autoplay/mute change.
  // Must be before early return to keep hooks order stable.
  const src = useMemo(
    () =>
      video
        ? toAutoplayEmbedUrl(video.embedUrl, {
            autoplay,
            muted,
            enableJsApi: true,
          })
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- video object identity changes; we only care about embedUrl
    [video?.embedUrl, autoplay, muted],
  );

  // Send listening handshake so YouTube iframe API dispatches player events
  const sendListeningHandshake = useCallback(() => {
    try {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: "listening" }),
        "*",
      );
    } catch {
      // cross-origin security guard
    }
  }, []);

  useEffect(() => {
    if (!displayOpen || !src) return;
    sendListeningHandshake();
    const t = setTimeout(sendListeningHandshake, 600);
    return () => clearTimeout(t);
  }, [displayOpen, src, sendListeningHandshake]);

  // Fallback thumb for fluid transition (marquee → theater) — via URL thumb or derived
  const thumb = fallbackThumb ?? null;
  const [iframeLoaded, setIframeLoaded] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset loading veil when src changes for opacity fade
    setIframeLoaded(false);
  }, [src]);

  // Build accessible label — honest when out-of-queue (index -1)

  const modalLabel = video
    ? `${video.title} — ${disciplineLabel}${categoryLabel ? ` · ${categoryLabel}` : ""}`
    : "";

  // Queue strip data — defaults to the single video when the grid passes nothing
  const stripQueue: readonly TvCard[] = queue ?? (video ? [video] : []);
  const stripActiveId = activeId ?? video?.id ?? null;

  // Keep mounted during closing animation even though video still present; only unmount when both closed
  if ((!video || !src) && !isClosing) return null;
  // During closing, video may still be present (isOpen true) — keep it
  const renderVideo = video;

  if (!renderVideo || !src) return null;

  return (
    <Overlay
      isOpen={displayOpen}
      onClose={handleRequestClose}
      labelledBy={titleId}
      describedBy={descId}
      role="dialog"
      closeOnBackdrop
      hideBackdrop
      flush
      containerClassName="bg-black p-0"
      panelClassName="flex h-dvh w-full flex-col bg-black text-white max-h-none max-w-none rounded-none border-0 overflow-hidden"
      initialFocus="first"
    >
      {/* Custom backdrop — black, since Overlay hideBackdrop is true. Click closes. */}
      <div
        aria-hidden="true"
        onClick={(e) => {
          e.stopPropagation();
          handleRequestClose();
        }}
        className="fixed inset-0 cursor-pointer bg-black"
      />

      <div
        ref={theaterRef}
        className="relative z-10 flex h-dvh w-full flex-col bg-black"
      >
        {/* Top bar — compact in landscape so the stage keeps max height */}
        <div className="flex shrink-0 items-center gap-2 border-b border-white/10 bg-black px-3 py-2 sm:px-4 sm:py-3 landscape:py-1 landscape:sm:py-1">
          <span
            className="hidden h-2 w-2 shrink-0 rounded-full bg-white sm:inline-flex"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p
              id={titleId}
              className="truncate font-display text-[10px] font-bold uppercase tracking-widest text-white/90 sm:text-[11px]"
            >
              Now Playing — {disciplineLabel}
              {categoryLabel ? ` · ${categoryLabel}` : ""}
            </p>
            <p
              id={descId}
              className="truncate text-[11px] font-semibold leading-tight text-white sm:text-xs landscape:hidden"
            >
              {renderVideo.title}
            </p>
          </div>

          <button
            type="button"
            onClick={handlePrev}
            disabled={!hasPrev || isClosing}
            aria-label="Previous video"
            title="Previous video"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={handleNext}
            disabled={!hasNext || isClosing}
            aria-label="Next video"
            title="Next video"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={onToggleAutoAdvance}
            aria-pressed={autoAdvance}
            aria-label={`Auto-advance ${autoAdvance ? "on" : "off"}`}
            title={
              autoAdvance
                ? "Auto-advance: on — next video plays automatically"
                : "Auto-advance: off"
            }
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 font-display text-[10px] font-bold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
              autoAdvance
                ? "border-white bg-white text-black"
                : "border-white/15 bg-white/10 text-white hover:bg-white/15"
            }`}
          >
            {autoAdvance ? (
              <Zap size={12} aria-hidden="true" />
            ) : (
              <Pause size={12} aria-hidden="true" />
            )}
            <span className="hidden sm:inline">
              {autoAdvance ? "Auto" : "Manual"}
            </span>
            <span className="sm:hidden">{autoAdvance ? "Auto" : "Off"}</span>
          </button>

          <button
            type="button"
            onClick={() => void handleShare()}
            aria-label="Share video"
            title="Share video"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1.5 font-display text-[10px] font-bold uppercase tracking-wide text-white hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            <Share2 size={12} aria-hidden="true" />
            <span className="hidden sm:inline">Share</span>
          </button>

          <button
            type="button"
            onClick={handleRequestClose}
            aria-label="Close player"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Stage — own compositor layer; only opacity fades (no filter/scale on the video box).
            Portrait: width-driven. Landscape: height-driven so the box never overflows. */}
        <div
          className="flex min-h-0 flex-1 touch-pan-y items-center justify-center bg-black sm:p-4 lg:p-6 landscape:p-2"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={isClosing ? { opacity: 0 } : { opacity: 1 }}
            transition={
              reduced
                ? { duration: 0.12 }
                : isClosing
                  ? { duration: 0.2, ease: "easeIn" }
                  : { duration: 0.25, ease: "easeOut" }
            }
            className="relative aspect-video w-full max-w-5xl overflow-hidden md:rounded-[12px] bg-black shadow-2xl ring-1 ring-white/10 [transform:translateZ(0)] landscape:h-full landscape:max-h-full landscape:w-auto landscape:max-w-full"
          >
            {thumb && !iframeLoaded && !isClosing ? (
              <Image
                src={thumb}
                alt={fallbackTitle ?? ""}
                fill
                sizes="(min-width:1024px) 64rem, (min-width:640px) 90vw, calc(100vw - 2rem)"
                referrerPolicy="no-referrer"
                className="object-cover opacity-60"
              />
            ) : null}
            <iframe
              key={renderVideo.id}
              ref={iframeRef}
              src={src}
              title={renderVideo.title}
              allow="autoplay; encrypted-media; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              onLoad={() => {
                setIframeLoaded(true);
                sendListeningHandshake();
              }}
              className={`block h-full w-full transition-opacity duration-300 ${
                iframeLoaded && !isClosing ? "opacity-100" : "opacity-0"
              }`}
            />
            {!iframeLoaded && !isClosing ? (
              <div className="pointer-events-none absolute inset-0 bg-black/20" />
            ) : null}
          </motion.div>
        </div>

        {/* In-dialog category filter — only when the queue spans categories */}
        {onSelectTheaterCategory &&
        theaterCategories &&
        theaterCategories.length > 1 ? (
          <div className="shrink-0 border-t border-white/10 bg-black">
            <TvCategoryPills
              options={theaterCategories}
              total={total}
              selected={theaterCategory ?? "all"}
              onSelect={onSelectTheaterCategory}
              disabled={isClosing}
            />
          </div>
        ) : null}

        {/* Bottom queue marquee — tap to jump straight to a video */}
        {onSelectVideo ? (
          <TvQueueStrip
            queue={stripQueue}
            activeId={stripActiveId}
            onSelect={onSelectVideo}
            disabled={isClosing}
            hasMore={hasMoreQueue}
            isLoadingMore={isLoadingQueue}
            onLoadMore={onLoadMoreQueue}
            total={total}
          />
        ) : null}

        {/* Hidden live region for screen readers */}
        <p className="sr-only" aria-live="polite">
          {modalLabel}
        </p>
      </div>
    </Overlay>
  );
}
