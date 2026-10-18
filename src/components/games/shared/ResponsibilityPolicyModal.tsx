"use client";

import { X } from "lucide-react";
import { Overlay } from "@/components/feedback/Overlay";

export function ResponsibilityPolicyModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <Overlay isOpen={isOpen} onClose={onClose} labelledBy="responsibility-policy-title" panelClassName="max-w-xl overflow-hidden rounded-[16px] border border-outline-variant bg-surface-bright">
      <div className="flex items-start justify-between gap-4 border-b border-outline-variant p-6">
        <div>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.05em] text-secondary">Before You Ride</p>
          <h2 id="responsibility-policy-title" className="mt-2 font-display text-[32px] font-bold leading-[1.3]">Ride Safe, Ride Smart</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close Safety Guidelines" className="flex h-11 w-11 items-center justify-center rounded-[16px] border border-outline-variant transition-colors hover:bg-surface-container focus-visible:outline-offset-4"><X size={14} aria-hidden="true" /></button>
      </div>
      <div className="space-y-4 p-6 text-sm leading-6 text-on-surface-variant">
        <p>OpenSpot Sets Up The Game — Not Supervision, Coaching, Or A Safety Guarantee For Any Spot.</p>
        <p>Scope The Surface, Traffic, Weather, Local Rules, And Your Own Limits Before You Send It. Rock Your Helmet And Pads, And Bail When It Doesn’t Feel Right.</p>
        <p>Every Rider Owns Their Calls — Respect The Spot, The Crew, And Everyone Around You.</p>
      </div>
      <div className="flex justify-end border-t border-outline-variant p-6"><button type="button" onClick={onClose} className="min-h-11 rounded-full border border-outline px-5 font-display text-xs font-bold uppercase tracking-[0.05em] transition-colors hover:bg-surface-container focus-visible:outline-offset-4">Got It, Let’s Ride</button></div>
    </Overlay>
  );
}
