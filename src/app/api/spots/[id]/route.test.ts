import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const findSpotByIdMock = vi.fn();

vi.mock("@/lib/services/spot/spots", () => ({
  findSpotById: (...args: unknown[]) => findSpotByIdMock(...args),
}));

vi.mock("@/lib/utils/log", () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { GET } from "./route";

function makeRequest(id: string): { url: string } {
  return { url: `http://localhost/api/spots/${id}` };
}

const fakeContext = (id: string) => ({
  params: Promise.resolve({ id }),
});

const sampleSpot = {
  id: "spot-1",
  slug: "macba",
  name: "MACBA",
  city: "Barcelona",
  citySlug: "barcelona",
  address: "Pl. dels Àngels, 1",
  types: [{ slug: "plaza", name: "Plaza" }],
  sports: ["skateboarding"],
  image: "https://example.com/img.png",
  country: "Spain",
  countryCode: "ES",
  location: { lat: 41.3833, lon: 2.163 },
  createdBy: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("GET /api/spots/[id]", () => {
  it("returns 200 with the spot when found", async () => {
    findSpotByIdMock.mockResolvedValue(sampleSpot);
    const res = await GET(
      makeRequest("spot-1") as never,
      fakeContext("spot-1") as never,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(sampleSpot);
    expect(findSpotByIdMock).toHaveBeenCalledWith("spot-1");
  });

  it("returns 404 when the spot is not found", async () => {
    findSpotByIdMock.mockResolvedValue(null);
    const res = await GET(
      makeRequest("missing") as never,
      fakeContext("missing") as never,
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("Spot not found");
  });

  it("returns 500 when the service throws", async () => {
    findSpotByIdMock.mockRejectedValue(new Error("db down"));
    const res = await GET(
      makeRequest("spot-1") as never,
      fakeContext("spot-1") as never,
    );
    expect(res.status).toBe(500);
  });
});

void NextResponse;
