"use client";

import { useState } from "react";
import { Link2, Check, Sparkles } from "lucide-react";
import { LegalCallout } from "@/components/legal/LegalCallout";
import type { LegalSection as TermsSectionType } from "@/lib/legal/terms-content";
import type { PrivacySection as PrivacySectionType } from "@/lib/legal/privacy-content";

export interface LegalSectionProps {
  section: TermsSectionType | PrivacySectionType;
  customCallout?: "risk" | "trespass" | "youtube" | "emergency";
  children?: React.ReactNode;
}

export function LegalSection({ section, customCallout, children }: LegalSectionProps) {
  const [copied, setCopied] = useState(false);
  const callout = customCallout ?? ("calloutType" in section ? section.calloutType : undefined);

  const handleCopyLink = () => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.hash = section.id;
    navigator.clipboard.writeText(url.toString()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <article
      id={section.id}
      aria-labelledby={`heading-${section.id}`}
      className="scroll-mt-24 rounded-[16px] border border-outline-variant bg-surface-container-lowest p-6 sm:p-8 md:p-10 transition-colors"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-outline-variant pb-6">
        <div>
          <span className="font-sans text-xs font-bold uppercase tracking-[0.1em] text-secondary">
            Section {section.number}
          </span>
          <h2
            id={`heading-${section.id}`}
            className="mt-1 font-display text-xl sm:text-2xl font-bold uppercase tracking-[-0.02em] text-on-surface"
          >
            {section.title}
          </h2>
        </div>

        <button
          type="button"
          onClick={handleCopyLink}
          aria-label={`Copy link to section ${section.title}`}
          title="Copy link to section"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-outline-variant bg-surface-container hover:bg-surface-container-high transition-colors focus-visible:outline-offset-2"
        >
          {copied ? (
            <Check size={16} className="text-permission-granted" aria-hidden="true" />
          ) : (
            <Link2 size={16} className="text-on-surface-variant" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Rider Takeaway / Plain English Highlight */}
      <div className="mt-6 rounded-[14px] border border-outline-variant/60 bg-surface-container-low p-4 sm:p-5">
        <div className="flex items-center gap-2 font-sans text-xs font-bold uppercase tracking-[0.08em] text-secondary">
          <Sparkles size={14} className="text-primary" aria-hidden="true" />
          <span>In Plain English</span>
        </div>
        <p className="mt-2 text-xs sm:text-sm leading-relaxed text-on-surface-variant font-medium">
          {section.plainEnglishSummary}
        </p>
      </div>

      {/* Callout Alert if applicable */}
      {callout ? <LegalCallout type={callout} /> : null}

      {/* Subsections & Formal Terms */}
      <div className="mt-8 space-y-6 text-xs sm:text-sm leading-7 text-on-surface-variant">
        {section.subsections.map((sub, idx) => (
          <div key={sub.id ?? idx} className="space-y-2">
            {sub.title ? (
              <h3 className="font-display text-sm font-bold uppercase tracking-[0.04em] text-on-surface">
                {sub.title}
              </h3>
            ) : null}
            {Array.isArray(sub.content) ? (
              sub.content.map((p, pIdx) => (
                <p key={pIdx} className="leading-relaxed">
                  {p}
                </p>
              ))
            ) : (
              <p className="leading-relaxed">{sub.content}</p>
            )}
          </div>
        ))}
      </div>

      {/* Children slot for extra tables or processors */}
      {children ? <div className="mt-8">{children}</div> : null}
    </article>
  );
}
