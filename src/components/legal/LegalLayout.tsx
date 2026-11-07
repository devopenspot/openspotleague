"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Printer, ShieldCheck, FileText, ChevronDown, ListChecks } from "lucide-react";
import { ROUTES } from "@/lib/navigation/nav";
import {
  BODY,
  CARD,
  CARD_FRAME,
  EYEBROW,
  META,
  PAGE_TITLE,
  SEGMENTED_TRACK,
  controlClass,
  pageContainer,
  segmentClass,
} from "@/components/ui/recipes";

export interface TOCItem {
  id: string;
  number: string;
  title: string;
}

export interface LegalLayoutProps {
  title: string;
  kicker: string;
  lastUpdated: string;
  version: string;
  keyPoints: readonly string[];
  tableOfContents: readonly TOCItem[];
  activeDoc: "terms" | "privacy";
  children: React.ReactNode;
}

export function LegalLayout({
  title,
  kicker,
  lastUpdated,
  version,
  keyPoints,
  tableOfContents,
  activeDoc,
  children,
}: LegalLayoutProps) {
  const [activeSection, setActiveSection] = useState<string>(tableOfContents[0]?.id ?? "");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      {
        rootMargin: "-20% 0px -70% 0px",
        threshold: 0,
      },
    );

    for (const item of tableOfContents) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [tableOfContents]);

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <div className="min-h-full bg-surface">
      <div className={pageContainer("7xl")}>
        {/* Top Breadcrumb & Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant pb-6 print:hidden">
          <Link
            href={ROUTES.home}
            className={controlClass("outline", "sm")}
          >
            <ArrowLeft size={14} aria-hidden="true" />
            <span>Back to Map</span>
          </Link>

          {/* Doc Switcher Tabs */}
          <nav aria-label="Legal document selection" className={SEGMENTED_TRACK}>
            <Link
              href="/terms"
              className={segmentClass(activeDoc === "terms")}
            >
              Terms of Use
            </Link>
            <Link
              href="/privacy"
              className={segmentClass(activeDoc === "privacy")}
            >
              Privacy Policy
            </Link>
          </nav>
        </div>

        {/* Hero Section */}
        <header className="my-8 sm:my-12">
          <p className={EYEBROW}>{kicker}</p>
          <h1 className={`mt-2 ${PAGE_TITLE} text-on-surface md:text-5xl`}>
            {title}
          </h1>
          <div className={`mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 ${META}`}>
            <span>Last updated {lastUpdated}</span>
            <span aria-hidden="true">•</span>
            <span>Version {version}</span>
          </div>
        </header>

        {/* Mobile Quick-Jump Dropdown */}
        <div className="mb-6 lg:hidden print:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="flex min-h-control w-full items-center justify-between gap-2 rounded-control border border-outline-variant bg-surface-container-lowest px-5 font-display text-xs font-bold uppercase tracking-pill text-on-surface transition-colors hover:border-outline"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-toc-list"
          >
            <span className="flex items-center gap-2">
              <FileText size={16} aria-hidden="true" />
              Contents ({tableOfContents.length} sections)
            </span>
            <ChevronDown
              size={16}
              className={`transform transition-transform ${mobileMenuOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>

          {mobileMenuOpen ? (
            <div
              id="mobile-toc-list"
              className={`mt-2 max-h-80 overflow-y-auto p-3 shadow-lg ${CARD_FRAME}`}
            >
              <ul className="space-y-1">
                {tableOfContents.map((item) => (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`block rounded-control px-3 py-2 text-xs font-medium transition-colors ${
                        activeSection === item.id
                          ? "bg-primary text-on-primary font-bold"
                          : "text-on-surface-variant hover:bg-surface-container"
                      }`}
                    >
                      <span className="mr-2 text-[10px] opacity-75">{item.number}</span>
                      {item.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        {/* Desktop 2-Column Content Layout */}
        <div className="grid gap-10 lg:grid-cols-[280px_1fr] xl:gap-14 items-start">
          {/* Sticky Sidebar on Desktop */}
          <aside
            aria-label="Document Table of Contents"
            className="sticky top-20 hidden lg:block space-y-6 print:hidden"
          >
            <div className={CARD}>
              <div className="flex items-center justify-between border-b border-outline-variant pb-3">
                <span className={EYEBROW}>Contents</span>
                <button
                  type="button"
                  onClick={handlePrint}
                  aria-label="Print this document"
                  title="Print / Save as PDF"
                  className={controlClass("outline", "sm")}
                >
                  <Printer size={13} aria-hidden="true" />
                  <span>Print</span>
                </button>
              </div>

              <nav className="mt-4 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
                <ul className="space-y-1">
                  {tableOfContents.map((item) => {
                    const isActive = activeSection === item.id;
                    return (
                      <li key={item.id}>
                        <a
                          href={`#${item.id}`}
                          className={`flex items-start gap-2 rounded-control px-3 py-1.5 text-xs transition-colors ${
                            isActive
                              ? "bg-primary text-on-primary font-semibold"
                              : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                          }`}
                        >
                          <span
                            className={`shrink-0 text-[10px] ${
                              isActive ? "text-on-primary/80" : "text-secondary font-bold"
                            }`}
                          >
                            {item.number}
                          </span>
                          <span className="truncate">{item.title}</span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            </div>

            {/* Support & Legal Inquiries Card */}
            <div className={`space-y-3 ${CARD}`}>
              <div className={`flex items-center gap-2 ${EYEBROW}`}>
                <ShieldCheck size={16} className="text-primary" aria-hidden="true" />
                <span>Legal Inquiries</span>
              </div>
              <p className="text-xs leading-relaxed text-on-surface-variant">
                Need to remove a spot, delete your data, or report a copied photo?
              </p>
              <div className="pt-1">
                <Link
                  href="/support"
                  className={`w-full ${controlClass("outline")}`}
                >
                  Contact Support
                </Link>
              </div>
            </div>
          </aside>

          {/* Main Legal Content Column */}
          <div className="min-w-0 space-y-6 sm:space-y-8">
            <section aria-labelledby="legal-key-points" className={CARD}>
              <h2
                id="legal-key-points"
                className={`flex items-center gap-2 ${EYEBROW}`}
              >
                <ListChecks size={16} className="text-primary" aria-hidden="true" />
                <span>The short version</span>
              </h2>
              <ul className={`mt-3 list-disc space-y-2 pl-5 marker:text-outline ${BODY}`}>
                {keyPoints.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </section>
            {children}
          </div>
        </div>

        {/* Footer print note */}
        <div className="mt-16 border-t border-outline-variant pt-8 text-center text-xs text-secondary print:mt-8">
          <p>
            © {new Date().getFullYear()} Open Spot League. Version {version} • Last updated{" "}
            {lastUpdated}.
          </p>
        </div>
      </div>
    </div>
  );
}
