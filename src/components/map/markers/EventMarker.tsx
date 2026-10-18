"use client";

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import { Marker } from "react-leaflet";
import type { MapEvent } from "@/types/sport-events";
import { cn } from "@/lib/utils/cn";

const LABEL_MAX_CHARS = 14;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function truncateLabel(name: string): string {
  if (name.length <= LABEL_MAX_CHARS) return name;
  return `${name.slice(0, LABEL_MAX_CHARS - 1).trimEnd()}…`;
}

// Status is read by form, not color (DESIGN.md: monochrome).
// live = solid filled square (pulses) — happening now
// upcoming = hollow square — on the calendar
// completed = square with a center dot — done
const STATUS_DOT_CLASS: Record<MapEvent["status"], string> = {
  live: "leaflet-event-pin__status-dot--live",
  upcoming: "leaflet-event-pin__status-dot--upcoming",
  completed: "leaflet-event-pin__status-dot--completed",
};

interface EventMarkerProps {
  event: MapEvent;
  isActive: boolean;
  onClick: (event: MapEvent) => void;
}

function buildEventPinHTML(event: MapEvent, isActive: boolean): string {
  const cls = ["leaflet-event-pin"];
  if (isActive) cls.push("leaflet-event-pin--active");

  const name = escapeHtml(truncateLabel(event.shortName ?? event.name));
  const tier = escapeHtml(event.categoryName);
  const date = escapeHtml(event.dateRangeLabel);

  return (
    `<div class="${cls.join(" ")}">` +
    `<span class="leaflet-event-pin__tier" aria-hidden="true"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4a2 2 0 0 0 0 4h2"/><path d="M18 9h2a2 2 0 0 1 0 4h-2"/><path d="M4 11V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6"/><path d="M6 21h12"/><path d="M8 17h8"/><path d="M8 21v-4a4 4 0 0 1 8 0v4"/></svg>${tier}</span>` +
    `<div class="leaflet-event-pin__square" data-status="${event.status}">` +
    `<span class="leaflet-event-pin__status-dot ${STATUS_DOT_CLASS[event.status]}" aria-hidden="true"></span>` +
    `<span class="leaflet-event-pin__label">${name}</span>` +
    `<span class="leaflet-event-pin__date">${date}</span>` +
    `</div>` +
    `</div>`
  );
}

export function EventMarker({ event, isActive, onClick }: EventMarkerProps) {
  const markerRef = useRef<L.Marker>(null);
  const icon = useMemo(() => {
    const html = buildEventPinHTML(event, isActive);
    return L.divIcon({
      className: cn("leaflet-event-pin-wrapper", isActive && "leaflet-event-pin-wrapper--active"),
      iconSize: isActive ? [152, 68] : [140, 64],
      iconAnchor: isActive ? [76, 18] : [70, 18],
      html,
    });
  }, [event, isActive]);

  useEffect(() => {
    const element = markerRef.current?.getElement();
    if (!element) return;
    element.setAttribute("role", "button");
    element.setAttribute(
      "aria-label",
      `Open ${event.name} event details. ${event.status}, ${event.dateRangeLabel}`,
    );
  }, [event.dateRangeLabel, event.name, event.status, icon]);

  const handleKeyDown = (keyboardEvent: L.LeafletKeyboardEvent) => {
    if (
      keyboardEvent.originalEvent.key !== " " &&
      keyboardEvent.originalEvent.key !== "Enter"
    ) {
      return;
    }
    keyboardEvent.originalEvent.preventDefault();
    keyboardEvent.originalEvent.stopPropagation();
    onClick(event);
  };

  return (
    <Marker
      ref={markerRef}
      position={[event.lat, event.lon]}
      icon={icon}
      zIndexOffset={isActive ? 1000 : 0}
      eventHandlers={{ click: () => onClick(event), keydown: handleKeyDown }}
      keyboard
      title={`${event.name} — ${event.categoryName}`}
      alt={event.name}
    />
  );
}
