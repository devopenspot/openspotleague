"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Printer, ShieldCheck, FileText, ChevronDown } from "lucide-react";
import { ROUTES } from "@/lib/navigation/nav";

export interface TOCItem {
  id: string;
  number: string;
  title: string;
}

export interface LegalLayoutProps {
  title: string;
  kicker: string;
  effectiveDate: string;
  lastUpdated: string;
  version: string;
  tableOfContents: readonly TOCItem[];
  activeDoc: "terms" | "privacy";
  children: React.ReactNode;
}

export function LegalLayout({
  title,
  kicker,
  effectiveDate,
  lastUpdated,
  version,
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
    <div className="min-h-screen bg-surface px-4 py-8 sm:px-6 md:px-10 md:py-12">
      <div className="mx-auto max-w-7xl">
        {/* Top Breadcrumb & Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant pb-6 print:hidden">
          <Link
            href={ROUTES.home}
            className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container px-4 py-2 text-xs font-bold uppercase tracking-[0.05em] text-on-surface hover:bg-surface-container-high transition-colors focus-visible:outline-offset-2"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            <span>Back to Map</span>
          </Link>

          {/* Doc Switcher Tabs */}
          <nav aria-label="Legal document selection" className="flex items-center gap-2">
            <Link
              href="/terms"
              className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.05em] transition-colors ${
                activeDoc === "terms"
                  ? "bg-primary text-on-primary"
                  : "border border-outline-variant bg-surface-container text-on-surface hover:bg-surface-container-high"
              }`}
            >
              Terms of Use
            </Link>
            <Link
              href="/privacy"
              className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.05em] transition-colors ${
                activeDoc === "privacy"
                  ? "bg-primary text-on-primary"
                  : "border border-outline-variant bg-surface-container text-on-surface hover:bg-surface-container-high"
              }`}
            >
              Privacy Policy
            </Link>
          </nav>
        </div>

        {/* Hero Section */}
        <header className="my-8 sm:my-12">
          <span className="font-sans text-xs font-bold uppercase tracking-[0.1em] text-secondary">
            {kicker}
          </span>
          <h1 className="mt-2 font-display text-3xl font-extrabold uppercase tracking-[-0.03em] text-on-surface sm:text-5xl md:text-6xl">
            {title}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-secondary font-medium">
            <span>Effective: {effectiveDate}</span>
            <span aria-hidden="true">•</span>
            <span>Last Updated: {lastUpdated}</span>
            <span aria-hidden="true">•</span>
            <span>Version {version}</span>
            <span aria-hidden="true">•</span>
            <span>Jurisdiction: Bogotá D.C., Colombia</span>
          </div>
        </header>

        {/* Mobile Quick-Jump Dropdown */}
        <div className="mb-6 lg:hidden print:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="flex w-full items-center justify-between rounded-[16px] border border-outline-variant bg-surface-container-lowest p-4 text-xs font-bold uppercase tracking-[0.05em] text-on-surface"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-toc-list"
          >
            <span className="flex items-center gap-2">
              <FileText size={16} aria-hidden="true" />
              Table of Contents ({tableOfContents.length} Sections)
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
              className="mt-2 max-h-80 overflow-y-auto rounded-[16px] border border-outline-variant bg-surface-container-lowest p-3 shadow-lg"
            >
              <ul className="space-y-1">
                {tableOfContents.map((item) => (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`block rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
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
            <div className="rounded-[16px] border border-outline-variant bg-surface-container-lowest p-5">
              <div className="flex items-center justify-between border-b border-outline-variant pb-3">
                <span className="font-display text-xs font-bold uppercase tracking-[0.1em] text-on-surface">
                  Contents
                </span>
                <button
                  type="button"
                  onClick={handlePrint}
                  aria-label="Print this document"
                  title="Print / Save as PDF"
                  className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.05em] text-secondary hover:text-primary transition-colors focus-visible:outline-offset-2"
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
                          className={`flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
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
            <div className="rounded-[16px] border border-outline-variant bg-surface-container-low p-5 space-y-3">
              <div className="flex items-center gap-2 font-display text-xs font-bold uppercase tracking-[0.08em] text-on-surface">
                <ShieldCheck size={16} className="text-primary" aria-hidden="true" />
                <span>Legal Inquiries</span>
              </div>
              <p className="text-xs leading-relaxed text-on-surface-variant">
                Need to report a spot, request data deletion, or submit a DMCA notice?
              </p>
              <div className="pt-1">
                <Link
                  href="/support"
                  className="inline-flex w-full items-center justify-center rounded-full border border-outline-variant bg-surface-container px-3 py-2 text-xs font-bold uppercase tracking-[0.05em] text-on-surface hover:bg-surface-container-high transition-colors focus-visible:outline-offset-2"
                >
                  Contact Support
                </Link>
              </div>
            </div>
          </aside>

          {/* Main Legal Content Column */}
          <main className="space-y-8 sm:space-y-10 min-w-0">{children}</main>
        </div>

        {/* Footer print note */}
        <div className="mt-16 border-t border-outline-variant pt-8 text-center text-xs text-secondary print:mt-8">
          <p>
            © {new Date().getFullYear()} Open Spot League. All rights reserved. Document version{" "}
            {version} • Effective {effectiveDate}.
          </p>
        </div>
      </div>
    </div>
  );
}
