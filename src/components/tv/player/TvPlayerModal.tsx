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
  ChevronLeft,
  ChevronRight,
  Share2,
  VolumeX,
  X,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Overlay } from "@/components/feedback/Overlay";
import { useKeyboardShortcuts } from "@/hooks/ui/useKeyboardShortcuts";
import { showToast } from "@/hooks/ui/useToast";
import { toAutoplayEmbedUrl } from "@/lib/tv/embed";
import { buildTvSharePath, formatTvPostDate } from "@/lib/tv/share";
import { youtubeThumbUrl, youtubeVideoId } from "@/lib/tv/urls";
import { cn } from "@/lib/utils/cn";
import { shareOrCopyUrl } from "@/lib/utils/share";
import { getOrFetchShortUrl } from "@/lib/utils/short-url";
import type { TvCard, TvCategory } from "@/types/tv";
import { TvQueueStrip } from "./TvQueueStrip";
import { TvCategoryPills, type TheaterCategory } from "./TvCategoryPills";
import { TvStudyBar } from "./TvStudyBar";
import {
  TV_BACK_SECONDS,
  isRealEnd,
  isUnplayableError,
  isUpNextWindow,
  loopRange,
  loopSeekTarget,
  nextPlaybackRate,
  type TvLoopRange,
  type TvPlaybackRate,
} from "./tv-study";
import {
  postYoutubeCommand,
  postYoutubeListening,
  useYoutubeBridge,
} from "./use-youtube-bridge";

interface TvPlayerModalProps {
  isOpen: boolean;
  video: TvCard | null;
  disciplineLabel: string;
  categoryLabel: string | null;
  hasPrev: boolean;
  hasNext: boolean;
  autoplay: boolean;
  /** Seconds to resume from; 0 starts at the beginning. */
  startAt?: number;
  /** Reports the watch position (throttled, plus on leaving a video). */
  onProgress?: (id: string, seconds: number, duration: number) => void;
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
// Swipe-to-navigate thresholds (mobile info strip swipe)
const SWIPE_MIN_DX = 48;
const SWIPE_AXIS_RATIO = 1.5;
const PROGRESS_SAVE_MS = 5000;
// Counts a video as started when the player never reports its time
const WATCH_FALLBACK_S = 10;
const UNPLAYABLE_SKIP_MS = 3000;
// After a swap the player reports the old video for a moment
const TIME_SETTLE_MS = 1000;
// Longest the next video's poster may cover the stage during a swap
const SWAP_POSTER_MAX_MS = 8000;

function whenNotTyping(e: KeyboardEvent, handler: () => void) {
  if (
    e.target instanceof HTMLInputElement ||
    e.target instanceof HTMLTextAreaElement
  ) {
    return;
  }
  e.preventDefault();
  handler();
}

export function TvPlayerModal({
  isOpen,
  video,
  disciplineLabel,
  categoryLabel,
  hasPrev,
  hasNext,
  autoplay,
  startAt = 0,
  onProgress,
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

  const theaterRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const playerVideoIdRef = useRef<string | null>(null);
  const watchRef = useRef<{ id: string; t: number; d: number } | null>(null);
  const lastSavedAtRef = useRef(0);
  const settleUntilRef = useRef(0);
  const lastLoopSeekAtRef = useRef(0);

  const displayOpen = isOpen || isClosing;
  const videoId = video?.id ?? null;

  // Stable theater src: always enablejsapi for ended detection.
  // Must be before early return to keep hooks order stable.
  const src = useMemo(
    () =>
      video
        ? toAutoplayEmbedUrl(video.embedUrl, {
            autoplay,
            enableJsApi: true,
            startSeconds: startAt,
          })
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- video object identity changes; we only care about embedUrl
    [video?.embedUrl, autoplay, startAt],
  );

  // The iframe keeps this src across queue moves: videos swap inside the live
  // player, because a fresh iframe would come back muted.
  const [stageSrc, setStageSrc] = useState(src);
  const [playerReady, setPlayerReady] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<TvPlaybackRate>(1);
  const [loop, setLoop] = useState<TvLoopRange | null>(null);
  const [nearEnd, setNearEnd] = useState(false);
  const [upNextCancelled, setUpNextCancelled] = useState(false);
  const [unplayable, setUnplayable] = useState(false);
  // The video whose frames are on screen. Anything else still shows a poster.
  const [framesFor, setFramesFor] = useState<string | null>(null);

  // Per-video state resets when the video changes (React recommended pattern)
  const [prevVideoId, setPrevVideoId] = useState(videoId);
  if (videoId !== prevVideoId) {
    setPrevVideoId(videoId);
    setPlaybackRate(1);
    setLoop(null);
    setNearEnd(false);
    setUpNextCancelled(false);
    setUnplayable(false);
    const canSwap =
      playerReady &&
      !unplayable &&
      prevVideoId !== null &&
      video !== null &&
      youtubeVideoId(video.youtubeUrl) !== null;
    if (!canSwap) {
      setStageSrc(src);
      setPlayerReady(false);
      setIframeLoaded(false);
      setIsMuted(autoplay);
    }
  }

  // A swap can take seconds on a phone: hold the poster, not a black stage.
  const awaitingFrames = autoplay && videoId !== null && framesFor !== videoId;

  const send = useCallback((func: string, args: unknown[] = []) => {
    postYoutubeCommand(iframeRef.current, func, args);
  }, []);

  const handlePlayerReady = useCallback(() => setPlayerReady(true), []);
  const handleUnplayable = useCallback(
    (code: number) => {
      const watch = watchRef.current;
      const hasPlayed = watch !== null && watch.t > startAt + 0.25;
      if (isUnplayableError(code, hasPlayed)) setUnplayable(true);
    },
    [startAt],
  );

  const handlePlayerTime = useCallback(
    (t: number, d: number) => {
      const now = Date.now();
      if (!videoId || now < settleUntilRef.current) return;
      watchRef.current = { id: videoId, t, d };
      // The player reports its start time while buffering; only moving time
      // means frames are on screen.
      if (t > startAt + 0.25) setFramesFor(videoId);
      if (loop) {
        const target = loopSeekTarget(loop, t, now - lastLoopSeekAtRef.current);
        if (target !== null) {
          lastLoopSeekAtRef.current = now;
          send("seekTo", [target, true]);
          send("playVideo");
        }
      }
      setNearEnd(isUpNextWindow(t, d));
      if (now - lastSavedAtRef.current >= PROGRESS_SAVE_MS) {
        lastSavedAtRef.current = now;
        onProgress?.(videoId, t, d);
      }
    },
    [videoId, startAt, loop, send, onProgress],
  );

  const flushProgress = useCallback(() => {
    const watch = watchRef.current;
    if (watch) onProgress?.(watch.id, watch.t, watch.d);
  }, [onProgress]);

  const handlePlayerEnded = useCallback(() => {
    const watch = watchRef.current;
    // A stray signal while a video plays must not skip it.
    if (Date.now() < settleUntilRef.current || !isRealEnd(watch?.t, watch?.d)) {
      return;
    }
    if (watch && watch.d > 0) onProgress?.(watch.id, watch.d, watch.d);
    watchRef.current = null;
    if (autoAdvance && !upNextCancelled) onEnded?.();
  }, [autoAdvance, upNextCancelled, onEnded, onProgress]);

  const { isPlayingRef, resetTiming } = useYoutubeBridge({
    enabled: displayOpen && Boolean(video) && !isClosing,
    initialPlaying: autoplay,
    onReady: handlePlayerReady,
    onEnded: handlePlayerEnded,
    onError: handleUnplayable,
    onTime: handlePlayerTime,
    onMuted: setIsMuted,
  });

  // Queue move inside a live player: swap the video, keep the sound on.
  useEffect(() => {
    if (!video) {
      playerVideoIdRef.current = null;
      watchRef.current = null;
      return;
    }
    const previous = playerVideoIdRef.current;
    if (previous === video.id) return;
    playerVideoIdRef.current = video.id;
    flushProgress();
    watchRef.current = null;
    lastSavedAtRef.current = Date.now();
    if (previous === null || !playerReady) return;
    const youtubeId = youtubeVideoId(video.youtubeUrl);
    if (!youtubeId) return;
    settleUntilRef.current = Date.now() + TIME_SETTLE_MS;
    resetTiming();
    send(autoplay ? "loadVideoById" : "cueVideoById", [
      { videoId: youtubeId, startSeconds: startAt },
    ]);
    send("setPlaybackRate", [1]);
  }, [video, playerReady, autoplay, startAt, send, flushProgress, resetTiming]);

  const handlePrev = useCallback(() => {
    if (hasPrev) onPrev();
  }, [hasPrev, onPrev]);

  const handleNext = useCallback(() => {
    if (hasNext) onNext();
  }, [hasNext, onNext]);

  const handleUnmute = useCallback(() => {
    send("unMute");
    send("setVolume", [100]);
    setIsMuted(false);
  }, [send]);

  const handleToggleMute = useCallback(() => {
    if (isMuted) {
      handleUnmute();
    } else {
      send("mute");
      setIsMuted(true);
    }
  }, [isMuted, handleUnmute, send]);

  const handleTogglePlay = useCallback(() => {
    const nextFunc = isPlayingRef.current ? "pauseVideo" : "playVideo";
    send(nextFunc);
    isPlayingRef.current = !isPlayingRef.current;
  }, [send, isPlayingRef]);

  const handleBack = useCallback(() => {
    const watch = watchRef.current;
    if (watch) send("seekTo", [Math.max(0, watch.t - TV_BACK_SECONDS), true]);
  }, [send]);

  const handleCycleRate = useCallback(() => {
    const next = nextPlaybackRate(playbackRate);
    setPlaybackRate(next);
    send("setPlaybackRate", [next]);
  }, [playbackRate, send]);

  const handleToggleLoop = useCallback(() => {
    if (loop) {
      setLoop(null);
      return;
    }
    const watch = watchRef.current;
    if (!watch) return;
    const range = loopRange(watch.t);
    setLoop(range);
    lastLoopSeekAtRef.current = Date.now();
    send("seekTo", [range.start, true]);
    send("playVideo");
  }, [loop, send]);

  const shortcuts = useMemo(
    () =>
      displayOpen && !isClosing
        ? [
            { key: "ArrowLeft", handler: handlePrev },
            { key: "ArrowRight", handler: handleNext },
            {
              key: " ",
              handler: (e: KeyboardEvent) => whenNotTyping(e, handleTogglePlay),
            },
            {
              key: "k",
              handler: (e: KeyboardEvent) => whenNotTyping(e, handleTogglePlay),
            },
            {
              key: "m",
              handler: (e: KeyboardEvent) => whenNotTyping(e, handleToggleMute),
            },
            {
              key: "j",
              handler: (e: KeyboardEvent) => whenNotTyping(e, handleBack),
            },
            {
              key: "l",
              handler: (e: KeyboardEvent) => whenNotTyping(e, handleToggleLoop),
            },
            {
              key: ",",
              handler: (e: KeyboardEvent) => whenNotTyping(e, handleCycleRate),
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
      handleBack,
      handleToggleLoop,
      handleCycleRate,
    ],
  );
  useKeyboardShortcuts(shortcuts);

  const handleRequestClose = useCallback(() => {
    if (isClosing) return;
    flushProgress();
    if (reduced) {
      onClose();
      return;
    }
    setIsClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, CLOSE_DELAY_MS);
  }, [isClosing, reduced, onClose, flushProgress]);

  // Clear a pending close timer on unmount
  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  // Canonical share link (/tv?play=<id>) shortened with fallback: native
  // share sheet on phones, clipboard elsewhere. A dismissed sheet is silent.
  const handleShare = useCallback(async () => {
    if (!video) return;
    try {
      const url = await getOrFetchShortUrl(
        buildTvSharePath(video.id),
        video.title,
      );
      const result = await shareOrCopyUrl(url, video.title);
      if (result === "copied") showToast("Link copied.", "success");
      else if (result === "failed" && !("share" in navigator)) {
        showToast("Could not share this link.", "error");
      }
    } catch {
      showToast("Could not share this link.", "error");
    }
  }, [video]);

  // Mobile swipe: horizontal swipe on the info strip navigates prev/next.
  // Attached there because touches over the YouTube iframe never bubble,
  // and on phones the iframe fills the whole stage.
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

  // Send listening handshake so YouTube iframe API dispatches player events
  const sendListeningHandshake = useCallback(() => {
    postYoutubeListening(iframeRef.current);
  }, []);

  useEffect(() => {
    if (!displayOpen || !stageSrc) return;
    isPlayingRef.current = autoplay;
    sendListeningHandshake();
    const t = setTimeout(sendListeningHandshake, 600);
    return () => clearTimeout(t);
    // Only a new iframe load restarts the handshake, not a toggle of `autoplay`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayOpen, stageSrc, sendListeningHandshake]);

  // No time events from the player: still count the video as started.
  useEffect(() => {
    if (!videoId || !iframeLoaded || !onProgress) return;
    const timer = setTimeout(() => {
      if (!watchRef.current) onProgress(videoId, WATCH_FALLBACK_S, 0);
    }, WATCH_FALLBACK_S * 1000);
    return () => clearTimeout(timer);
  }, [videoId, iframeLoaded, onProgress]);

  useEffect(() => {
    if (!awaitingFrames) return;
    const timer = setTimeout(() => setFramesFor(videoId), SWAP_POSTER_MAX_MS);
    return () => clearTimeout(timer);
  }, [awaitingFrames, videoId]);

  // A video that can't be embedded must not stall an autoplay queue.
  useEffect(() => {
    if (!unplayable || !autoAdvance || !hasNext) return;
    const timer = setTimeout(handleNext, UNPLAYABLE_SKIP_MS);
    return () => clearTimeout(timer);
  }, [unplayable, autoAdvance, hasNext, handleNext]);

  // Poster for the fluid transition (marquee → theater); the URL thumb only
  // covers a deep link whose card hasn't resolved yet.
  const thumb =
    (video ? youtubeThumbUrl(video.youtubeUrl, "hq") : null) ??
    fallbackThumb ??
    null;

  // "All" adds nothing next to the sport name
  const contextLabel = categoryLabel === "All" ? null : categoryLabel;

  // Build accessible label — honest when out-of-queue (index -1)

  const modalLabel = video
    ? `${video.title} — ${disciplineLabel}${contextLabel ? ` · ${contextLabel}` : ""}`
    : "";

  const videoFormattedDate = video?.postDate
    ? formatTvPostDate(video.postDate)
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

  const upNext =
    nearEnd && autoAdvance && !upNextCancelled && activeIndex !== -1
      ? (stripQueue[activeIndex + 1] ?? null)
      : null;

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
      panelClassName="flex h-dvh w-full flex-col bg-black text-on-wire max-h-none max-w-none rounded-none border-0 overflow-hidden"
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
        <div className="flex shrink-0 items-center justify-between gap-1.5 sm:gap-2 border-b border-wire-border bg-black px-3 py-2 sm:px-4 sm:py-3 landscape:py-1 landscape:sm:py-1">
          <div className="hidden sm:flex min-w-0 flex-1 items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full bg-on-wire"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p
                id={titleId}
                className="truncate font-display text-[10px] font-bold uppercase tracking-widest text-on-wire sm:text-[11px]"
              >
                Now playing · {disciplineLabel}
                {contextLabel ? ` · ${contextLabel}` : ""}
              </p>
              <p
                id={descId}
                className="truncate text-[11px] font-semibold leading-tight text-on-wire sm:text-xs landscape:hidden"
              >
                {renderVideo.title}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
            <p className="hidden font-display text-[10px] font-bold uppercase tracking-wider text-wire-muted sm:block">
              {videoFormattedDate}
            </p>
            <button
              type="button"
              onClick={handlePrev}
            disabled={!hasPrev || isClosing}
            aria-label="Previous video"
            title="Previous video"
            className="inline-flex h-9 w-9 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full border border-wire-border-strong bg-wire-border text-on-wire hover:bg-wire-border-strong disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black touch-manipulation"
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={handleNext}
            disabled={!hasNext || isClosing}
            aria-label="Next video"
            title="Next video"
            className="inline-flex h-9 w-9 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full border border-wire-border-strong bg-wire-border text-on-wire hover:bg-wire-border-strong disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black touch-manipulation"
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={onToggleAutoAdvance}
            aria-pressed={autoAdvance}
            aria-label={`Autoplay next ${autoAdvance ? "on" : "off"}`}
            title={
              autoAdvance
                ? "Autoplay next: on — next video plays automatically"
                : "Autoplay next: off"
            }
            className={cn(
              "inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full border border-wire-border-strong bg-wire-border px-2.5 py-1.5 font-display text-[10px] font-bold uppercase tracking-wide transition-colors hover:bg-wire-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black touch-manipulation sm:px-3",
              autoAdvance ? "text-on-wire" : "text-wire-muted",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "relative h-3 w-5 shrink-0 rounded-full transition-colors",
                autoAdvance ? "bg-on-wire" : "bg-wire-border-strong",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-2 w-2 rounded-full transition-[left]",
                  autoAdvance ? "left-2.5 bg-black" : "left-0.5 bg-on-wire",
                )}
              />
            </span>
            <span>Autoplay next</span>
          </button>

          <button
            type="button"
            onClick={() => void handleShare()}
            aria-label="Share video"
            title="Share video"
            className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full border border-wire-border-strong bg-wire-border px-3 py-1.5 font-display text-[10px] font-bold uppercase tracking-wide text-on-wire hover:bg-wire-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black touch-manipulation"
          >
            <Share2 size={12} aria-hidden="true" />
            <span className="hidden sm:inline">Share</span>
          </button>

          <button
            type="button"
            onClick={handleRequestClose}
            aria-label="Close player"
            className="inline-flex h-9 w-9 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full border border-wire-border-strong bg-wire-border text-on-wire hover:bg-wire-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black touch-manipulation"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

        {/* Stage — own compositor layer; only opacity fades (no filter/scale on the video box).
            Portrait: width-driven, anchored top on mobile. Landscape: cinema mode without chrome squeeze. */}
        <div className="flex min-h-0 max-sm:shrink-0 sm:flex-1 items-center justify-center bg-black sm:p-4 lg:p-6 landscape:flex-1 landscape:p-1">
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
            {thumb && (!iframeLoaded || awaitingFrames) && !isClosing ? (
              <Image
                src={thumb}
                alt={fallbackTitle ?? ""}
                fill
                sizes="(min-width:1024px) 64rem, (min-width:640px) 90vw, calc(100vw - 2rem)"
                referrerPolicy="no-referrer"
                className="pointer-events-none z-10 object-cover opacity-60"
              />
            ) : null}
            <iframe
              ref={iframeRef}
              src={stageSrc ?? src}
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

            {upNext ? (
              <div className="absolute right-2 top-2 z-20 flex max-w-[85%] items-center gap-2 rounded-full border border-wire-border-strong bg-black/85 py-1 pl-3 pr-1 text-[11px] font-medium text-on-wire shadow-xl backdrop-blur-md">
                <span className="min-w-0 truncate">Up next: {upNext.title}</span>
                <button
                  type="button"
                  onClick={() => setUpNextCancelled(true)}
                  className="shrink-0 rounded-full bg-wire-border-strong px-2.5 py-1 font-semibold transition-colors hover:bg-on-wire hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white touch-manipulation"
                >
                  Cancel
                </button>
              </div>
            ) : null}

            {unplayable ? (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black px-4 text-center">
                <p className="text-sm font-semibold text-on-wire">
                  This video can&apos;t play here
                </p>
                <div className="flex items-center gap-2">
                  <a
                    href={renderVideo.youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center rounded-full bg-on-wire px-4 font-display text-[13px] font-semibold text-black transition-colors hover:bg-on-wire/90"
                  >
                    Watch on YouTube
                  </a>
                  {hasNext ? (
                    <button
                      type="button"
                      onClick={handleNext}
                      className="inline-flex min-h-11 items-center rounded-full border border-wire-border-strong bg-wire-border px-4 font-display text-[13px] font-semibold text-on-wire transition-colors hover:bg-wire-border-strong"
                    >
                      Next
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* Floating Unmute Cue — prominent and tap-friendly when starting muted */}
            {isMuted && iframeLoaded && !isClosing ? (
              <button
                type="button"
                onClick={handleUnmute}
                aria-label="Unmute video"
                className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 inline-flex items-center gap-1.5 rounded-full border border-wire-border-strong bg-black/85 px-3.5 py-1.5 font-display text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-on-wire shadow-xl backdrop-blur-md transition-all hover:scale-105 hover:bg-black active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white touch-manipulation"
              >
                <VolumeX size={14} className="text-on-wire" aria-hidden="true" />
                <span>Tap to unmute</span>
              </button>
            ) : null}
          </motion.div>
        </div>

        {/* Mobile portrait info strip — fills the letterbox void with relevant metadata */}
        <div
          className="sm:hidden px-3.5 py-2.5 flex flex-col gap-1 border-b border-wire-border bg-black shrink-0 touch-pan-y landscape:hidden"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded border border-wire-border-strong bg-wire-border px-2 py-0.5 font-display text-[9px] font-bold uppercase tracking-wider text-on-wire">
              <span
                className="h-1.5 w-1.5 rounded-full bg-on-wire"
                aria-hidden="true"
              />
              {disciplineLabel}
            </span>
            {contextLabel ? (
              <span className="font-display text-[10px] font-bold uppercase tracking-wider text-wire-muted">
                {contextLabel}
              </span>
            ) : null}
            {stripQueue.length > 0 && activeIndex !== -1 ? (
              <span className="text-[11px] font-medium text-wire-muted ml-auto">
                {activeIndex + 1} of {stripQueue.length}
              </span>
            ) : null}
          </div>
          <h2 className="text-xs font-semibold text-on-wire line-clamp-2 leading-snug">
            {renderVideo.title}
          </h2>
          {videoFormattedDate ? (
            <p className="text-[11px] text-wire-muted">{videoFormattedDate}</p>
          ) : null}
        </div>

        {/* Mobile portrait flexible spacer so queue and pills sit anchored cleanly */}
        <div className="sm:hidden flex-1 min-h-0 landscape:hidden" />

        <TvStudyBar
          rate={playbackRate}
          looping={loop !== null}
          disabled={isClosing || unplayable}
          onBack={handleBack}
          onCycleRate={handleCycleRate}
          onToggleLoop={handleToggleLoop}
        />

        {/* In-dialog category filter — hidden on phone landscape to maximize screen height for video */}
        {onSelectTheaterCategory &&
        theaterCategories &&
        theaterCategories.length > 1 ? (
          <div className="shrink-0 max-h-48 border-t border-wire-border bg-black landscape:hidden sm:landscape:block">
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
          <div className="shrink-0 border-t border-wire-border bg-black landscape:hidden sm:landscape:block">
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
