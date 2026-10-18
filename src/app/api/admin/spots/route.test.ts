import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const requireCurationAccessMock = vi.fn();
const requireSpotCurationAccessMock = vi.fn();
const createSpotMock = vi.fn();
const uploadSpotImageMock = vi.fn();

function authorizationErrorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : "Unauthorized";
  return new Response(JSON.stringify({ error: message }), {
    status: message === "Admin only" ? 403 : 401,
    headers: { "Content-Type": "application/json" },
  });
}

vi.mock("@/lib/auth/server", () => ({
  requireCurationAccess: (...args: unknown[]) => requireCurationAccessMock(...args),
  requireSpotCurationAccess: (...args: unknown[]) => requireSpotCurationAccessMock(...args),
  authorizationErrorResponse,
}));

vi.mock("@/lib/services/spot/spots", () => ({
  createSpot: (...args: unknown[]) => createSpotMock(...args),
}));

vi.mock("@/lib/storage", () => ({
  UploadValidationError: class UploadValidationError extends Error {},
  uploadSpotImage: (...args: unknown[]) => uploadSpotImageMock(...args),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/utils/log", () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { POST } from "./route";

const sampleSpot = {
  id: "spot-1",
  slug: "test",
  name: "Test",
  city: "Test",
  citySlug: "test",
  address: "x",
  types: [],
  sports: [],
  image: "x",
  country: "",
  countryCode: "",
  location: { lat: 0, lon: 0 },
  createdBy: null,
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
};

function makeFormRequest(fields: Record<string, string>): NextRequest {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  return new NextRequest("http://localhost/api/admin/spots", {
    method: "POST",
    body: form,
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  requireCurationAccessMock.mockResolvedValue({ id: "user-1" });
  requireSpotCurationAccessMock.mockResolvedValue({ id: "user-1" });
  createSpotMock.mockResolvedValue(sampleSpot);
  uploadSpotImageMock.mockResolvedValue({
    path: "spots/test.png",
    url: "https://storage.example.com/spot.png",
  });
});

describe("POST /api/admin/spots", () => {
  it("returns 401 when not signed in", async () => {
    requireCurationAccessMock.mockRejectedValue(new Error("Not signed in"));
    const res = await POST(makeFormRequest({ name: "x", city: "y" }));
    expect(res.status).toBe(401);
    expect(createSpotMock).not.toHaveBeenCalled();
  });

  it("returns 403 when signed in but not admin", async () => {
    requireCurationAccessMock.mockRejectedValue(new Error("Admin only"));
    const res = await POST(makeFormRequest({ name: "x", city: "y" }));
    expect(res.status).toBe(403);
  });

  it("returns 201 with the created spot", async () => {
    const res = await POST(
      makeFormRequest({
        name: "Test Spot",
        city: "Test City",
        address: "1 Main St",
        type: "plaza",
        lat: "45.7",
        lon: "4.8",
        countryCode: "FR",
        country: "France",
      }),
    );
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(sampleSpot);
    expect(createSpotMock).toHaveBeenCalled();
  });

  it("returns 400 for invalid body (missing name)", async () => {
    const res = await POST(
      makeFormRequest({ city: "Test City", lat: "45.7", lon: "4.8" }),
    );
    expect(res.status).toBe(400);
    expect(createSpotMock).not.toHaveBeenCalled();
  });

  it("returns 400 when body is not multipart/form-data", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/admin/spots", {
        method: "POST",
        body: "plain text",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 500 when the service throws", async () => {
    createSpotMock.mockRejectedValue(new Error("db down"));
    const res = await POST(
      makeFormRequest({
        name: "Test Spot",
        city: "Test City",
        lat: "45.7",
        lon: "4.8",
        countryCode: "FR",
        country: "France",
      }),
    );
    expect(res.status).toBe(500);
  });
});
