import { describe, it, expect } from "vitest";
import {
  TERMS_KEY_POINTS,
  TERMS_SECTIONS,
  TERMS_VERSION,
  TERMS_EFFECTIVE_DATE,
} from "@/lib/legal/terms-content";
import {
  PRIVACY_KEY_POINTS,
  PRIVACY_SECTIONS,
  PRIVACY_VERSION,
  PRIVACY_EFFECTIVE_DATE,
  THIRD_PARTY_PROCESSORS,
} from "@/lib/legal/privacy-content";
import type { LegalSection } from "@/lib/legal/types";
import { ROUTES } from "@/lib/navigation/nav";

function text(section: LegalSection | undefined): string {
  return section ? [section.title, section.summary, ...section.points].join(" ") : "";
}

const TECHNICAL_TERMS = [
  "creatorIpHash",
  "localStorage",
  "HMAC",
  "Row-Level",
  "TLS",
  "OAuth",
  "Supabase Auth",
  "17 U.S.C.",
];

describe("Terms of Use content", () => {
  it("defines version, date and sections", () => {
    expect(TERMS_VERSION).toBe("2.0");
    expect(TERMS_EFFECTIVE_DATE).toBeDefined();
    expect(TERMS_SECTIONS.length).toBe(9);
    expect(TERMS_KEY_POINTS.length).toBeGreaterThanOrEqual(3);
  });

  it("has unique section ids, and every section has a summary and points", () => {
    const ids = TERMS_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of TERMS_SECTIONS) {
      expect(s.summary.length).toBeGreaterThan(0);
      expect(s.points.length).toBeGreaterThan(0);
    }
  });

  it("keeps the risk and property sections the footer links to", () => {
    const risk = TERMS_SECTIONS.find((s) => s.id === "risk-waiver");
    expect(risk?.calloutType).toBe("risk");
    expect(text(risk)).toContain("own risk");
    expect(text(risk)).toContain("helmet");

    const property = TERMS_SECTIONS.find((s) => s.id === "spots-property");
    expect(property?.calloutType).toBe("trespass");
    expect(text(property)).toContain("trespass");
  });

  it("requires riders to be 13+ with guardian consent under 18", () => {
    const acceptance = text(TERMS_SECTIONS.find((s) => s.id === "acceptance"));
    expect(acceptance).toContain("13");
    expect(acceptance).toContain("guardian");
  });

  it("covers betting, fair play, YouTube, takedowns and governing law", () => {
    const games = text(TERMS_SECTIONS.find((s) => s.id === "games-league"));
    expect(games).toContain("betting");
    expect(games).toContain("location");

    expect(text(TERMS_SECTIONS.find((s) => s.id === "conduct"))).toContain("YouTube");
    expect(text(TERMS_SECTIONS.find((s) => s.id === "ugc"))).toContain(
      "legal@openspotleague.com",
    );

    const legal = text(TERMS_SECTIONS.find((s) => s.id === "legal"));
    expect(legal).toContain("Colombia");
    expect(legal).toContain("arbitration in Bogotá");
    expect(legal).toContain("USD 50");
  });

  it("avoids technical jargon", () => {
    const all = TERMS_SECTIONS.map(text).join(" ");
    for (const term of TECHNICAL_TERMS) expect(all).not.toContain(term);
  });
});

describe("Privacy Policy content", () => {
  it("defines version, date and sections", () => {
    expect(PRIVACY_VERSION).toBe("2.0");
    expect(PRIVACY_EFFECTIVE_DATE).toBeDefined();
    expect(PRIVACY_SECTIONS.length).toBe(8);
    expect(PRIVACY_KEY_POINTS.length).toBeGreaterThanOrEqual(3);
  });

  it("has unique section ids", () => {
    const ids = PRIVACY_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("names the data laws and the Colombian authority", () => {
    const overview = text(PRIVACY_SECTIONS.find((s) => s.id === "overview"));
    expect(overview).toContain("Law 1581 of 2012");
    expect(overview).toContain("Habeas Data");
    expect(overview).toContain("GDPR");
    expect(overview).toContain("CCPA/CPRA");
    expect(overview).toContain("never sell");

    const rights = text(PRIVACY_SECTIONS.find((s) => s.id === "user-rights"));
    expect(rights).toContain("Superintendencia de Industria y Comercio");
    expect(rights).toContain("under 13");
  });

  it("says location is only used on demand", () => {
    const collected = text(PRIVACY_SECTIONS.find((s) => s.id === "information-collected"));
    expect(collected).toContain("only when you tap");
    expect(collected).toContain("never track your location in the background");
  });

  it("lists the key services we use", () => {
    const names = THIRD_PARTY_PROCESSORS.map((p) => p.name);
    expect(names.some((n) => n.includes("Supabase"))).toBe(true);
    expect(names.some((n) => n.includes("Cloudflare"))).toBe(true);
    expect(names.some((n) => n.includes("OpenWeather"))).toBe(true);
    expect(names.some((n) => n.includes("Google") || n.includes("YouTube"))).toBe(true);
    expect(names.some((n) => n.includes("Vercel"))).toBe(false);
    for (const p of THIRD_PARTY_PROCESSORS) expect(p.privacyUrl).toMatch(/^https:\/\//);
  });

  it("avoids technical jargon", () => {
    const all = PRIVACY_SECTIONS.map(text).join(" ");
    for (const term of TECHNICAL_TERMS) expect(all).not.toContain(term);
  });
});

describe("Navigation & Route Registration", () => {
  it("registers terms and privacy in ROUTES constant", () => {
    expect(ROUTES.terms).toBe("/terms");
    expect(ROUTES.privacy).toBe("/privacy");
  });
});
