"use client";

import { AlertTriangle, ShieldAlert, Youtube, PhoneCall } from "lucide-react";

export interface LegalCalloutProps {
  type: "risk" | "trespass" | "youtube" | "emergency";
}

export function LegalCallout({ type }: LegalCalloutProps) {
  if (type === "risk") {
    return (
      <aside
        aria-label="Action Sports Physical Risk Notice"
        className="my-6 rounded-[16px] border border-accent-start/30 bg-accent-start/5 p-5 text-on-surface sm:p-6"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-start/15 text-accent-start">
            <AlertTriangle size={20} aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <h4 className="font-display text-sm font-bold uppercase tracking-[0.05em] text-accent-start">
              Critical Warning: Inherent Extreme Sports Danger
            </h4>
            <p className="text-xs sm:text-sm leading-relaxed text-on-surface-variant">
              Skateboarding, BMX, inline skating, and scootering carry extreme risks of broken bones, head trauma, permanent paralysis, and death. OpenSpot does not inspect spots, test surfaces, or provide physical supervision. <strong>You ride entirely at your own risk. Helmets and protective pads save lives.</strong>
            </p>
          </div>
        </div>
      </aside>
    );
  }

  if (type === "trespass") {
    return (
      <aside
        aria-label="Private Property & Anti-Trespassing Advisory"
        className="my-6 rounded-[16px] border border-outline-variant bg-surface-container-low p-5 text-on-surface sm:p-6"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary">
            <ShieldAlert size={20} aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <h4 className="font-display text-sm font-bold uppercase tracking-[0.05em] text-on-surface">
              Respect the Spot: Zero Tolerance for Trespassing
            </h4>
            <p className="text-xs sm:text-sm leading-relaxed text-on-surface-variant">
              Listing on OpenSpot is an informational index, <strong>never an authorization or license to enter</strong>. Riders must obey municipal bans, respect private property, and verify operating hours. OpenSpot is not responsible for trespass citations, property defacement, or fines.
            </p>
          </div>
        </div>
      </aside>
    );
  }

  if (type === "youtube") {
    return (
      <aside
        aria-label="YouTube API Services Disclosure"
        className="my-6 rounded-[16px] border border-outline-variant bg-surface-container-low p-5 text-on-surface sm:p-6"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-error-container text-error">
            <Youtube size={20} aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <h4 className="font-display text-sm font-bold uppercase tracking-[0.05em] text-on-surface">
              YouTube API Services Notice
            </h4>
            <p className="text-xs sm:text-sm leading-relaxed text-on-surface-variant">
              OpenSpot TV streams embedded videos via YouTube API Services. By browsing or watching videos, you agree to be bound by the{" "}
              <a
                href="https://www.youtube.com/t/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold underline decoration-outline hover:text-primary focus-visible:outline-offset-2"
              >
                YouTube Terms of Service
              </a>{" "}
              and acknowledge the{" "}
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold underline decoration-outline hover:text-primary focus-visible:outline-offset-2"
              >
                Google Privacy Policy
              </a>
              .
            </p>
          </div>
        </div>
      </aside>
    );
  }

  if (type === "emergency") {
    return (
      <aside
        aria-label="Emergency Numbers Informational Advisory"
        className="my-6 rounded-[16px] border border-outline-variant bg-surface-container-low p-5 text-on-surface sm:p-6"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-on-secondary">
            <PhoneCall size={20} aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <h4 className="font-display text-sm font-bold uppercase tracking-[0.05em] text-on-surface">
              Emergency Phone Numbers Advisory
            </h4>
            <p className="text-xs sm:text-sm leading-relaxed text-on-surface-variant">
              Emergency numbers shown on OpenSpot are compiled for informational convenience only. In any life-threatening accident or acute medical emergency, <strong>dial your nation's official emergency services dispatch directly</strong> (e.g. 911 in the US/Canada, 112 in the EU, 123 in Colombia, 999 in the UK).
            </p>
          </div>
        </div>
      </aside>
    );
  }

  return null;
}
