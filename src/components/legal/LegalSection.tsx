"use client";

import { useState } from "react";
import { Link2, Check } from "lucide-react";
import { LegalCallout } from "@/components/legal/LegalCallout";
import type { LegalSection as LegalSectionData } from "@/lib/legal/types";
import {
  BODY,
  CARD_FRAME,
  EYEBROW,
  SECTION_TITLE,
  iconButtonClass,
} from "@/components/ui/recipes";

export interface LegalSectionProps {
  section: LegalSectionData;
  children?: React.ReactNode;
}

export function LegalSection({ section, children }: LegalSectionProps) {
  const [copied, setCopied] = useState(false);

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
      className={`scroll-mt-24 p-5 sm:p-8 ${CARD_FRAME}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={EYEBROW}>{section.number}</p>
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

      <p className="mt-4 text-base leading-relaxed font-medium text-on-surface">
        {section.summary}
      </p>

      {section.calloutType ? <LegalCallout type={section.calloutType} /> : null}

      <ul className={`mt-4 list-disc space-y-2 pl-5 marker:text-outline ${BODY}`}>
        {section.points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>

      {children ? <div className="mt-6">{children}</div> : null}
    </article>
  );
}
