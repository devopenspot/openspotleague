import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import type { ShortLink } from "@/db/schema";
import { ShortLinkValidationError } from "@/lib/utils/short-code";

const mockIsShortLinksEnabled = vi.fn();
const mockCreateShortLink = vi.fn();

vi.mock("@/lib/config/feature-flags", () => ({
  isShortLinksEnabled: () => mockIsShortLinksEnabled(),
}));

vi.mock("@/lib/services/short-link/short-links", () => ({
  createShortLink: (input: unknown, origin?: string) => mockCreateShortLink(input, origin),
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

describe("POST /api/short-links", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsShortLinksEnabled.mockReturnValue(true);
  });

  it("returns 503 when feature flag is disabled", async () => {
    mockIsShortLinksEnabled.mockReturnValue(false);

    const request = new NextRequest("https://openspotleague.com/api/short-links", {
      method: "POST",
      body: JSON.stringify({ url: "/spots/spot-1" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(503);
    const data = await response.json();
    expect(data.error).toBe("Short links feature is disabled");
    expect(mockCreateShortLink).not.toHaveBeenCalled();
  });

  it("returns 400 when body is invalid JSON", async () => {
    const request = new NextRequest("https://openspotleague.com/api/short-links", {
      method: "POST",
      body: "not-json",
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Invalid JSON body");
  });

  it("returns 400 when url is missing or empty", async () => {
    const request = new NextRequest("https://openspotleague.com/api/short-links", {
      method: "POST",
      body: JSON.stringify({ url: "" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Validation error");
  });

  it("returns 400 when createShortLink throws ShortLinkValidationError", async () => {
    mockCreateShortLink.mockRejectedValueOnce(
      new ShortLinkValidationError("External domains are not permitted as short link targets"),
    );

    const request = new NextRequest("https://openspotleague.com/api/short-links", {
      method: "POST",
      body: JSON.stringify({ url: "https://evil.com/hack" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("External domains are not permitted as short link targets");
  });

  it("returns 200 with short link payload on success", async () => {
    const row = mockRow("7xK9q2A", "/spots/spot-1");
    mockCreateShortLink.mockResolvedValueOnce(row);

    const request = new NextRequest("https://openspotleague.com/api/short-links", {
      method: "POST",
      body: JSON.stringify({ url: "/spots/spot-1", title: "Spot One" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({
      code: "7xK9q2A",
      shortUrl: "https://openspotleague.com/s/7xK9q2A",
      targetUrl: "/spots/spot-1",
    });
  });
});
