import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { LegalLayout } from "@/components/legal/LegalLayout";
import { LegalSection } from "@/components/legal/LegalSection";
import {
  PRIVACY_SECTIONS,
  PRIVACY_EFFECTIVE_DATE,
  PRIVACY_LAST_UPDATED,
  PRIVACY_VERSION,
  COOKIE_INVENTORY,
  THIRD_PARTY_PROCESSORS,
} from "@/lib/legal/privacy-content";
import { env } from "@/lib/config/env";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Open Spot League Privacy Policy: complete transparency on data collection, on-demand geolocation, cookies, GDPR, CCPA, and Colombian Law 1581 (Habeas Data) compliance.",
  alternates: {
    canonical: "/privacy",
  },
  openGraph: {
    title: "Privacy Policy · Open Spot League",
    description:
      "Open Spot League Privacy Policy: complete transparency on data collection, on-demand geolocation, cookies, GDPR, CCPA, and Colombian Law 1581 (Habeas Data) compliance.",
    url: `${env.APP_URL}/privacy`,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Privacy Policy · Open Spot League",
    description:
      "Open Spot League Privacy Policy: complete transparency on data collection, on-demand geolocation, cookies, GDPR, CCPA, and Colombian Law 1581 (Habeas Data) compliance.",
  },
};

export default function PrivacyPage() {
  const toc = PRIVACY_SECTIONS.map((s) => ({
    id: s.id,
    number: s.number,
    title: s.title,
  }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Privacy Policy · Open Spot League",
    description:
      "Open Spot League Privacy Policy: transparency on data collection, geolocation, GDPR, CCPA, and Colombian Law 1581 compliance.",
    url: `${env.APP_URL}/privacy`,
    datePublished: "2026-10-21",
    dateModified: "2026-10-21",
    publisher: {
      "@type": "Organization",
      name: "Open Spot League",
      url: env.APP_URL,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LegalLayout
        title="Privacy Policy"
        kicker="Data Protection & Privacy"
        effectiveDate={PRIVACY_EFFECTIVE_DATE}
        lastUpdated={PRIVACY_LAST_UPDATED}
        version={PRIVACY_VERSION}
        tableOfContents={toc}
        activeDoc="privacy"
      >
        {PRIVACY_SECTIONS.map((section) => {
          let customChild: React.ReactNode = null;

          if (section.id === "cookies-storage") {
            customChild = (
              <div className="overflow-x-auto rounded-[14px] border border-outline-variant bg-surface-container-lowest">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-outline-variant bg-surface-container font-sans uppercase tracking-[0.05em] text-on-surface">
                      <th className="p-3.5">Name / Key</th>
                      <th className="p-3.5">Type</th>
                      <th className="p-3.5">Category</th>
                      <th className="p-3.5">Purpose</th>
                      <th className="p-3.5">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant text-on-surface-variant">
                    {COOKIE_INVENTORY.map((item) => (
                      <tr key={item.name} className="hover:bg-surface-container-low transition-colors">
                        <td className="p-3.5 font-mono font-semibold text-on-surface">{item.name}</td>
                        <td className="p-3.5">{item.type}</td>
                        <td className="p-3.5">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              item.category === "Strictly Necessary"
                                ? "bg-primary text-on-primary"
                                : "bg-surface-container-high text-on-surface"
                            }`}
                          >
                            {item.category}
                          </span>
                        </td>
                        <td className="p-3.5 max-w-xs">{item.purpose}</td>
                        <td className="p-3.5 whitespace-nowrap">{item.duration}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }

          if (section.id === "third-parties") {
            customChild = (
              <div className="overflow-x-auto rounded-[14px] border border-outline-variant bg-surface-container-lowest">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-outline-variant bg-surface-container font-sans uppercase tracking-[0.05em] text-on-surface">
                      <th className="p-3.5">Provider</th>
                      <th className="p-3.5">Role</th>
                      <th className="p-3.5">Location</th>
                      <th className="p-3.5">Function</th>
                      <th className="p-3.5">Privacy Notice</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant text-on-surface-variant">
                    {THIRD_PARTY_PROCESSORS.map((p) => (
                      <tr key={p.name} className="hover:bg-surface-container-low transition-colors">
                        <td className="p-3.5 font-semibold text-on-surface">{p.name}</td>
                        <td className="p-3.5">{p.role}</td>
                        <td className="p-3.5 whitespace-nowrap">{p.country}</td>
                        <td className="p-3.5 max-w-xs">{p.purpose}</td>
                        <td className="p-3.5 whitespace-nowrap">
                          <a
                            href={p.privacyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-primary underline decoration-outline hover:text-primary-focus focus-visible:outline-offset-2"
                          >
                            <span>Policy</span>
                            <ExternalLink size={12} aria-hidden="true" />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }

          return (
            <LegalSection key={section.id} section={section}>
              {customChild}
            </LegalSection>
          );
        })}
      </LegalLayout>
    </>
  );
}
