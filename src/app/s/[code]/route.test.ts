import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import type { ShortLink } from "@/db/schema";

const mockResolveShortLink = vi.fn();

vi.mock("@/lib/services/short-link/short-links", () => ({
  resolveShortLink: (code: string) => mockResolveShortLink(code),
}));

function mockRow(code: string, targetUrl: string): ShortLink {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    code,
    targetUrl,
    title: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  };
}

describe("GET /s/[code]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects with 302 to '/' when code format is invalid", async () => {
    const request = new NextRequest("https://openspotleague.com/s/invalid!");
    const response = await GET(request, {
      params: Promise.resolve({ code: "invalid!" }),
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("https://openspotleague.com/");
    expect(mockResolveShortLink).not.toHaveBeenCalled();
  });

  it("returns 404 with short cache headers when code does not exist", async () => {
    mockResolveShortLink.mockResolvedValueOnce(null);

    const request = new NextRequest("https://openspotleague.com/s/notfnd7");
    const response = await GET(request, {
      params: Promise.resolve({ code: "notfnd7" }),
    });

    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=60, s-maxage=300");
    expect(await response.text()).toBe("Short link not found");
  });

  it("returns 307 with edge surrogate cache headers and target location when found", async () => {
    const row = mockRow("7xK9q2A", "/spots/spot-1");
    mockResolveShortLink.mockResolvedValueOnce(row);

    const request = new NextRequest("https://openspotleague.com/s/7xK9q2A");
    const response = await GET(request, {
      params: Promise.resolve({ code: "7xK9q2A" }),
    });

    expect(response.status).toBe(307);
    expect(response.headers.get("Location")).toBe("https://openspotleague.com/spots/spot-1");
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    );
  });
});
