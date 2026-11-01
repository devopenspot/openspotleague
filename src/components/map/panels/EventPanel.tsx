"use client";

import { Calendar, ExternalLink, MapPin, Trophy, X } from "lucide-react";
import type { MapEvent } from "@/types/sport-events";
import { Countdown } from "@/components/ui/Countdown";
import { ShareActions } from "@/components/ui/ShareActions";

interface EventPanelProps {
  event: MapEvent;
  onClose: () => void;
  titleId: string;
  panelRef: React.RefObject<HTMLDivElement | null>;
}

export function EventPanel({
  event,
  onClose,
  titleId,
  panelRef,
}: EventPanelProps) {
  const isLive = event.status === "live";
  const isCompleted = event.status === "completed";

  return (
    <div
      ref={panelRef}
      id="map-event-popup"
      role="dialog"
      aria-labelledby={titleId}
      tabIndex={-1}
      className="fixed bottom-0 left-0 right-0 z-[1150] max-h-[80vh] w-auto overflow-y-auto rounded-t-[16px] border border-outline-variant bg-surface-bright pb-[env(safe-area-inset-bottom)] outline-none animate-slide-up no-scrollbar md:absolute md:bottom-5 md:left-auto md:right-3 md:w-96 md:rounded-[8px] md:pb-0"
    >
      <div className="relative min-h-[238px] overflow-hidden bg-on-surface text-surface">
        <div
          className="absolute -right-12 -top-16 h-64 w-64 rounded-full bg-primary/20 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 bg-gradient-to-r from-on-surface via-on-surface/75 to-on-surface/30"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-on-surface via-on-surface/20 to-on-surface/40"
          aria-hidden="true"
        />
        <Trophy
          size={150}
          strokeWidth={0.7}
          aria-hidden="true"
          className="absolute -bottom-8 -right-5 text-surface/[0.12]"
        />

        <div className="absolute inset-0 flex flex-col justify-between p-4 md:p-5">
          <div className="flex items-start justify-between gap-3">
            <span className="inline-block rounded-md border border-surface/50 bg-on-surface/30 px-2 py-1 font-display text-xs font-semibold tracking-[0.05em] text-surface uppercase">
              {event.categoryName}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close event details"
              className="-mr-2 -mt-2 flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border-2 border-surface/40 text-surface transition-[background-color,transform] hover:bg-surface/10 focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 active:translate-y-px"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>

          <div className="max-w-[90%] space-y-2">
            <h4
              id={titleId}
              className="font-display text-3xl font-bold leading-[1.15] tracking-[-0.02em] text-surface uppercase"
            >
              {event.name}
            </h4>
            <p
              aria-label={`Status: ${event.status}`}
              className="flex items-center gap-1.5 font-display text-xs font-semibold uppercase tracking-[0.05em] text-surface/70"
            >
              <span
                aria-hidden="true"
                className={
                  isLive
                    ? "h-1.5 w-1.5 bg-surface -dot"
                    : isCompleted
                      ? "relative h-1.5 w-1.5 border border-surface after:absolute after:left-1/2 after:top-1/2 after:h-0.5 after:w-0.5 after:-translate-x-1/2 after:-translate-y-1/2 after:bg-surface after:content-['']"
                      : "h-1.5 w-1.5 border border-surface"
                }
              />
              {event.status === "completed" ? "Past" : event.status}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3 p-3 md:p-5">
        <dl className="space-y-2 border-y border-outline-variant py-3">
          <div className="flex items-center gap-2 text-on-surface">
            <Calendar
              size={12}
              className="shrink-0 text-secondary"
              aria-hidden="true"
            />
            <dt className="sr-only">Date</dt>
            <dd className="font-display text-xs font-semibold tracking-[0.05em] uppercase">
              {event.dateRangeLabel}
            </dd>
          </div>
          {event.status === "upcoming" ? (
            <div className="flex items-center gap-2 text-on-surface">
              <Trophy
                size={12}
                className="shrink-0 text-secondary"
                aria-hidden="true"
              />
              <dt className="sr-only">Starts in</dt>
              <dd className="font-display text-xs font-semibold tracking-[0.05em] uppercase">
                Starts in{" "}
                <Countdown
                  target={event.startDate}
                  label={`${event.name} starts in`}
                />
              </dd>
            </div>
          ) : null}
          <div className="flex items-center gap-2 text-on-surface">
            <MapPin
              size={12}
              className="shrink-0 text-secondary"
              aria-hidden="true"
            />
            <dt className="sr-only">Location</dt>
            <dd className="text-sm font-semibold leading-5 text-secondary">
              <span className="text-on-surface">
                {event.city}
              </span>
              {event.country ? `, ${event.country}` : ""}
            </dd>
          </div>
        </dl>

        {event.url ? (
          <a
            href={event.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${event.name} website (opens in a new tab)`}
            className="flex min-h-12 w-full items-center justify-center gap-1.5 rounded-lg border-2 border-on-surface font-display text-sm font-bold tracking-[0.04em] text-on-surface uppercase transition-[background-color,transform] hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 active:translate-y-px"
          >
            <span>Event website</span>
            <ExternalLink size={11} aria-hidden="true" />
          </a>
        ) : null}
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${event.lat},${event.lon}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${event.name} in Google Maps (opens in a new tab)`}
          className="flex min-h-12 w-full items-center justify-center gap-1.5 rounded-lg border-2 border-on-surface bg-on-surface font-display text-sm font-bold tracking-[0.04em] text-surface uppercase transition-[background-color,transform] hover:bg-on-surface/90 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 active:translate-y-px"
        >
          <span>Directions</span>
          <ExternalLink size={11} aria-hidden="true" />
        </a>
        <ShareActions
          url={`/sport-events/${encodeURIComponent(event.slug)}`}
          title={event.name}
          className="pt-1"
        />
      </div>
    </div>
  );
}
