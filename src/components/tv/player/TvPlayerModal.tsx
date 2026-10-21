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
import {
  //   ChevronLeft,
  //   ChevronRight,
  Pause,
  Share2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Overlay } from "@/components/feedback/Overlay";
import { useKeyboardShortcuts } from "@/hooks/ui/useKeyboardShortcuts";
import { showToast } from "@/hooks/ui/useToast";
import { toAutoplayEmbedUrl } from "@/lib/tv/embed";
import { buildTvSharePath } from "@/lib/tv/share";
import { getOrFetchShortUrl } from "@/lib/utils/short-url";
import type { TvCard, TvCategory } from "@/types/tv";
import { TvQueueStrip } from "./TvQueueStrip";
import { TvCategoryPills, type TheaterCategory } from "./TvCategoryPills";

interface TvPlayerModalProps {
  isOpen: boolean;
  video: TvCard | null;
  disciplineLabel: string;
  categoryLabel: string | null;
  hasPrev: boolean;
  hasNext: boolean;
  autoplay: boolean;
  autoAdvance: boolean;
  onToggleAutoAdvance: () => void;
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
  theaterCategories?: readonly { category: TvCategory; count?: number }[];
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
  disciplineLabel,
  categoryLabel,
  hasPrev,
  hasNext,
  autoplay,
  autoAdvance,
  onToggleAutoAdvance,
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
  const [isMuted, setIsMuted] = useState(() => autoplay);
  const isPlayingRef = useRef(autoplay);

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

  const sendPostMessage = useCallback((func: string, args: unknown[] = []) => {
    try {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func, args }),
        "*",
      );
    } catch {
      // cross-origin security guard
    }
  }, []);

  const handleUnmute = useCallback(() => {
    sendPostMessage("unMute");
    sendPostMessage("setVolume", [100]);
    setIsMuted(false);
  }, [sendPostMessage]);

  const handleToggleMute = useCallback(() => {
    if (isMuted) {
      handleUnmute();
    } else {
      sendPostMessage("mute");
      setIsMuted(true);
    }
  }, [isMuted, handleUnmute, sendPostMessage]);

  const handleTogglePlay = useCallback(() => {
    const nextFunc = isPlayingRef.current ? "pauseVideo" : "playVideo";
    sendPostMessage(nextFunc);
    isPlayingRef.current = !isPlayingRef.current;
  }, [sendPostMessage]);

  const shortcuts = useMemo(
    () =>
      displayOpen && !isClosing
        ? [
            { key: "ArrowLeft", handler: handlePrev },
            { key: "ArrowRight", handler: handleNext },
            {
              key: " ",
              handler: (e: KeyboardEvent) => {
                if (
                  e.target instanceof HTMLInputElement ||
                  e.target instanceof HTMLTextAreaElement
                ) {
                  return;
                }
                e.preventDefault();
                handleTogglePlay();
              },
            },
            {
              key: "k",
              handler: (e: KeyboardEvent) => {
                if (
                  e.target instanceof HTMLInputElement ||
                  e.target instanceof HTMLTextAreaElement
                ) {
                  return;
                }
                e.preventDefault();
                handleTogglePlay();
              },
            },
            {
              key: "m",
              handler: (e: KeyboardEvent) => {
                if (
                  e.target instanceof HTMLInputElement ||
                  e.target instanceof HTMLTextAreaElement
                ) {
                  return;
                }
                e.preventDefault();
                handleToggleMute();
              },
            },
          ]
        : [],
    [
      displayOpen,
      isClosing,
      handlePrev,
      handleNext,
      handleTogglePlay,
      handleToggleMute,
    ],
  );
  useKeyboardShortcuts(shortcuts);

  // YouTube iframe API postMessage event detection (ended, play/pause, volume)
  // Filters by origin + JSON shape for performance.
  useEffect(() => {
    if (!displayOpen || !video || isClosing) return;
    const handler = (event: MessageEvent) => {
      // Restrict to YouTube origins to avoid processing every postMessage in the app
      if (
        event.origin &&
        !event.origin.includes("youtube") &&
        !event.origin.includes("youtu.be")
      )
        return;
      if (typeof event.data !== "string") return;
      const mightBeRelevant =
        event.data.includes('"playerState"') ||
        event.data.includes('"onStateChange"') ||
        event.data.includes('"info"');
      if (!mightBeRelevant) return;
      try {
        const data = JSON.parse(event.data);
        if (data.event === "onStateChange") {
          if (data.info === 1) isPlayingRef.current = true;
          else if (data.info === 2) isPlayingRef.current = false;
        } else if (data.event === "infoDelivery" && data.info) {
          if (data.info.playerState === 1) isPlayingRef.current = true;
          else if (data.info.playerState === 2) isPlayingRef.current = false;
          if (data.info.muted === false) setIsMuted(false);
          else if (data.info.muted === true) setIsMuted(true);
        }

        // Auto-advance ended detection (state 0 = ended)
        if (autoAdvance && onEnded) {
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

  // Canonical share link (/tv?play=<id>) shortened with fallback, directly copied to clipboard.
  const handleShare = useCallback(async () => {
    if (!video) return;
    try {
      const url = await getOrFetchShortUrl(
        buildTvSharePath(video.id),
        video.title,
      );
      await navigator.clipboard.writeText(url);
      showToast("Link copied.", "success");
    } catch {
      showToast("Could not share this link.", "error");
    }
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

  // Stable theater src: always enablejsapi for ended detection
  // Rebuilds only on video/autoplay change.
  // Must be before early return to keep hooks order stable.
  const src = useMemo(
    () =>
      video
        ? toAutoplayEmbedUrl(video.embedUrl, {
            autoplay,
            enableJsApi: true,
          })
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- video object identity changes; we only care about embedUrl
    [video?.embedUrl, autoplay],
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
    setIsMuted(autoplay);
    isPlayingRef.current = autoplay;
  }, [src, autoplay]);

  // Build accessible label — honest when out-of-queue (index -1)

  const modalLabel = video
    ? `${video.title} — ${disciplineLabel}${categoryLabel ? ` · ${categoryLabel}` : ""}`
    : "";

  // Queue strip data — defaults to the single video when the grid passes nothing
  const stripQueue = useMemo<readonly TvCard[]>(
    () => queue ?? (video ? [video] : []),
    [queue, video],
  );
  const stripActiveId = activeId ?? video?.id ?? null;
  const activeIndex = useMemo(() => {
    if (!stripActiveId) return -1;
    return stripQueue.findIndex((v) => v.id === stripActiveId);
  }, [stripQueue, stripActiveId]);

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
        <div className="flex shrink-0 items-center justify-end gap-1.5 sm:gap-2 border-b border-white/10 bg-black px-3 py-2 sm:px-4 sm:py-3 landscape:py-1 landscape:sm:py-1">
          {/* <button
            type="button"
            onClick={handlePrev}
            disabled={!hasPrev || isClosing}
            aria-label="Previous video"
            title="Previous video"
            className="inline-flex h-9 w-9 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black touch-manipulation"
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button> */}

          {/* <button
            type="button"
            onClick={handleNext}
            disabled={!hasNext || isClosing}
            aria-label="Next video"
            title="Next video"
            className="inline-flex h-9 w-9 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black touch-manipulation"
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button> */}

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
            className={`inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 font-display text-[10px] font-bold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black touch-manipulation ${
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
            className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 font-display text-[10px] font-bold uppercase tracking-wide text-white hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black touch-manipulation"
          >
            <Share2 size={12} aria-hidden="true" />
            <span className="hidden sm:inline">Share</span>
          </button>

          <button
            type="button"
            onClick={handleRequestClose}
            aria-label="Close player"
            className="inline-flex h-9 w-9 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black touch-manipulation"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Stage — own compositor layer; only opacity fades (no filter/scale on the video box).
            Portrait: width-driven, anchored top on mobile. Landscape: cinema mode without chrome squeeze. */}
        <div
          className="flex min-h-0 max-sm:shrink-0 sm:flex-1 touch-pan-y items-center justify-center bg-black sm:p-4 lg:p-6 landscape:flex-1 landscape:p-1"
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
              allow="autoplay; encrypted-media; picture-in-picture; web-share; fullscreen"
              allowFullScreen
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

            {/* Floating Unmute Cue — prominent and tap-friendly when starting muted */}
            {isMuted && iframeLoaded && !isClosing ? (
              <button
                type="button"
                onClick={handleUnmute}
                aria-label="Unmute video"
                className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-black/85 px-3.5 py-1.5 font-display text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-white shadow-xl backdrop-blur-md transition-all hover:scale-105 hover:bg-black active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white touch-manipulation"
              >
                <VolumeX size={14} className="text-white" aria-hidden="true" />
                <span>Tap to unmute</span>
              </button>
            ) : null}
          </motion.div>
        </div>

        {/* Mobile portrait info strip — fills the letterbox void with relevant metadata */}
        <div className="sm:hidden px-3.5 py-2.5 flex flex-col gap-1 border-b border-white/10 bg-black shrink-0 landscape:hidden">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded border border-white/20 bg-white/10 px-2 py-0.5 font-display text-[9px] font-bold uppercase tracking-wider text-white">
              <span
                className="h-1.5 w-1.5 rounded-full bg-white"
                aria-hidden="true"
              />
              {disciplineLabel}
            </span>
            {categoryLabel ? (
              <span className="font-display text-[10px] font-bold uppercase tracking-wider text-white/70">
                {categoryLabel}
              </span>
            ) : null}
            {stripQueue.length > 0 && activeIndex !== -1 ? (
              <span className="text-[11px] font-medium text-white/40 ml-auto">
                {activeIndex + 1} of {stripQueue.length}
              </span>
            ) : null}
          </div>
          <h2 className="text-xs font-semibold text-white line-clamp-2 leading-snug">
            {renderVideo.title}
          </h2>
        </div>

        {/* Mobile portrait flexible spacer so queue and pills sit anchored cleanly */}
        <div className="sm:hidden flex-1 min-h-0 landscape:hidden" />

        {/* In-dialog category filter — hidden on phone landscape to maximize screen height for video */}
        {onSelectTheaterCategory &&
        theaterCategories &&
        theaterCategories.length > 1 ? (
          <div className="shrink-0 border-t border-white/10 bg-black landscape:hidden sm:landscape:block">
            <TvCategoryPills
              options={theaterCategories}
              selected={theaterCategory ?? "all"}
              onSelect={onSelectTheaterCategory}
              disabled={isClosing}
            />
          </div>
        ) : null}

        {/* Bottom queue marquee — hidden on phone landscape to prevent cramped vertical squishing */}
        {onSelectVideo ? (
          <div className="shrink-0 border-t border-white/10 bg-black landscape:hidden sm:landscape:block">
            <TvQueueStrip
              queue={stripQueue}
              activeId={stripActiveId}
              onSelect={onSelectVideo}
              disabled={isClosing}
              hasMore={hasMoreQueue}
              isLoadingMore={isLoadingQueue}
              onLoadMore={onLoadMoreQueue}
            />
          </div>
        ) : null}

        {/* Hidden live region for screen readers */}
        <p className="sr-only" aria-live="polite">
          {modalLabel}
        </p>
      </div>
    </Overlay>
  );
}
