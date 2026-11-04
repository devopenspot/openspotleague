"use client";

import { useState } from "react";
import { Link2, Check, Sparkles } from "lucide-react";
import { LegalCallout } from "@/components/legal/LegalCallout";
import type { LegalSection as TermsSectionType } from "@/lib/legal/terms-content";
import type { PrivacySection as PrivacySectionType } from "@/lib/legal/privacy-content";
import {
  CARD_FRAME,
  CARD_NESTED,
  EYEBROW,
  SECTION_TITLE,
  iconButtonClass,
} from "@/components/ui/recipes";

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
      className={`scroll-mt-24 p-5 sm:p-8 md:p-10 ${CARD_FRAME}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-outline-variant pb-6">
        <div>
          <p className={EYEBROW}>Section {section.number}</p>
          <h2
            id={`heading-${section.id}`}
            className={`mt-1 ${SECTION_TITLE} text-on-surface`}
          >
            {section.title}
          </h2>
        </div>

        <button
          type="button"
          onClick={handleCopyLink}
          aria-label={`Copy link to section ${section.title}`}
          title="Copy link to section"
          className={iconButtonClass("outline")}
        >
          {copied ? (
            <Check size={16} className="text-permission-granted" aria-hidden="true" />
          ) : (
            <Link2 size={16} className="text-on-surface-variant" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Rider Takeaway / Plain English Highlight */}
      <div className={`mt-6 ${CARD_NESTED} sm:p-5`}>
        <div className={`flex items-center gap-2 ${EYEBROW}`}>
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
              <h3 className="font-display text-sm font-bold uppercase leading-tight tracking-tight text-on-surface">
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
