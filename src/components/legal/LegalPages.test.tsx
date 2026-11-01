import { describe, it, expect } from "vitest";
import {
  TERMS_SECTIONS,
  TERMS_VERSION,
  TERMS_EFFECTIVE_DATE,
} from "@/lib/legal/terms-content";
import {
  PRIVACY_SECTIONS,
  PRIVACY_VERSION,
  PRIVACY_EFFECTIVE_DATE,
  COOKIE_INVENTORY,
  THIRD_PARTY_PROCESSORS,
} from "@/lib/legal/privacy-content";
import { ROUTES } from "@/lib/navigation/nav";

describe("Terms of Use Content & Legal Integrity", () => {
  it("defines standard metadata and effective dates", () => {
    expect(TERMS_VERSION).toBe("1.0");
    expect(TERMS_EFFECTIVE_DATE).toBeDefined();
    expect(TERMS_SECTIONS.length).toBe(14);
  });

  it("contains unique and valid section identifiers", () => {
    const ids = TERMS_SECTIONS.map((s) => s.id);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });

  it("covers essential action sports liability, trespass, and risk waivers", () => {
    const riskSection = TERMS_SECTIONS.find((s) => s.id === "risk-waiver");
    expect(riskSection).toBeDefined();
    expect(riskSection?.calloutType).toBe("risk");
    expect(JSON.stringify(riskSection)).toContain("Assumption of Risk");
    expect(JSON.stringify(riskSection)).toContain("helmet");

    const trespassSection = TERMS_SECTIONS.find((s) => s.id === "spots-property");
    expect(trespassSection).toBeDefined();
    expect(trespassSection?.calloutType).toBe("trespass");
    expect(JSON.stringify(trespassSection)).toContain("Trespass");
  });

  it("mandates 13+ age restriction in compliance with COPPA & minor protection", () => {
    const acceptanceSection = TERMS_SECTIONS.find((s) => s.id === "acceptance");
    expect(acceptanceSection).toBeDefined();
    expect(JSON.stringify(acceptanceSection)).toContain("thirteen (13)");
    expect(JSON.stringify(acceptanceSection)).toContain("COPPA");
  });

  it("includes YouTube API Services compliance disclosure", () => {
    const tvSection = TERMS_SECTIONS.find((s) => s.id === "tv-youtube");
    expect(tvSection).toBeDefined();
    expect(tvSection?.calloutType).toBe("youtube");
    expect(JSON.stringify(tvSection)).toContain("YouTube Terms of Service");
    expect(JSON.stringify(tvSection)).toContain("Google Privacy Policy");
  });

  it("contains non-gambling skill game rules and anti-cheating GPS terms", () => {
    const gameSection = TERMS_SECTIONS.find((s) => s.id === "challenge-games");
    expect(gameSection).toBeDefined();
    expect(JSON.stringify(gameSection)).toContain("gambling");
    expect(JSON.stringify(gameSection)).toContain("GPS");
  });

  it("specifies DMCA designated takedown procedure", () => {
    const dmcaSection = TERMS_SECTIONS.find((s) => s.id === "dmca");
    expect(dmcaSection).toBeDefined();
    expect(JSON.stringify(dmcaSection)).toContain("17 U.S.C. § 512");
    expect(JSON.stringify(dmcaSection)).toContain("legal@openspotleague.com");
  });

  it("establishes Colombian governing law, Bogotá D.C. venue, and arbitration", () => {
    const govSection = TERMS_SECTIONS.find((s) => s.id === "governing-law");
    expect(govSection).toBeDefined();
    expect(JSON.stringify(govSection)).toContain("Republic of Colombia");
    expect(JSON.stringify(govSection)).toContain("Bogotá D.C.");
    expect(JSON.stringify(govSection)).toContain("Cámara de Comercio de Bogotá");
  });
});

describe("Privacy Policy Content & Regulatory Compliance", () => {
  it("defines standard metadata and effective dates", () => {
    expect(PRIVACY_VERSION).toBe("1.0");
    expect(PRIVACY_EFFECTIVE_DATE).toBeDefined();
    expect(PRIVACY_SECTIONS.length).toBe(12);
  });

  it("contains unique and valid section identifiers", () => {
    const ids = PRIVACY_SECTIONS.map((s) => s.id);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });

  it("harmonizes with Colombian Law 1581 of 2012 (Habeas Data)", () => {
    const overviewSection = PRIVACY_SECTIONS.find((s) => s.id === "overview");
    expect(overviewSection).toBeDefined();
    expect(JSON.stringify(overviewSection)).toContain("Law 1581 of 2012");
    expect(JSON.stringify(overviewSection)).toContain("Habeas Data");

    const rightsSection = PRIVACY_SECTIONS.find((s) => s.id === "user-rights");
    expect(rightsSection).toBeDefined();
    expect(JSON.stringify(rightsSection)).toContain("Superintendencia de Industria y Comercio");
  });

  it("incorporates GDPR and CCPA/CPRA disclosures with a strict No-Sale commitment", () => {
    const allText = JSON.stringify(PRIVACY_SECTIONS);
    expect(allText).toContain("GDPR");
    expect(allText).toContain("CCPA/CPRA");
    expect(allText).toContain("does not sell");
  });

  it("discloses on-demand geolocation collection without background tracking", () => {
    const geoSection = PRIVACY_SECTIONS.find((s) => s.id === "information-collected");
    expect(geoSection).toBeDefined();
    expect(JSON.stringify(geoSection)).toContain("Geolocation Data");
    expect(JSON.stringify(geoSection)).toContain("NEVER tracks your location continuously in the background");
  });

  it("lists all essential cookies and functional localStorage items", () => {
    expect(COOKIE_INVENTORY.length).toBeGreaterThanOrEqual(5);
    const cookieNames = COOKIE_INVENTORY.map((c) => c.name);
    expect(cookieNames).toContain("sb-*-auth-token");
    expect(cookieNames).toContain("osp_seed");
    expect(cookieNames).toContain("openspot-preferences");
    expect(cookieNames).toContain("openspot-guest-token");
  });

  it("lists key third-party processors including Supabase and Cloudflare", () => {
    const processorNames = THIRD_PARTY_PROCESSORS.map((p) => p.name);
    expect(processorNames.some((n) => n.includes("Supabase"))).toBe(true);
    expect(processorNames.some((n) => n.includes("Vercel"))).toBe(false);
    expect(processorNames.some((n) => n.includes("Cloudflare"))).toBe(true);
    expect(processorNames.some((n) => n.includes("OpenWeather"))).toBe(true);
    expect(processorNames.some((n) => n.includes("Google") || n.includes("YouTube"))).toBe(true);
  });
});

describe("Navigation & Route Registration", () => {
  it("registers terms and privacy in ROUTES constant", () => {
    expect(ROUTES.terms).toBe("/terms");
    expect(ROUTES.privacy).toBe("/privacy");
  });
});
