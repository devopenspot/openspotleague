import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import type { SpotFacetCity } from "@/lib/repositories/core/types";

const listMock = vi.fn();

vi.mock("@/lib/services/spot/cities", () => ({
  listCitiesForCountry: (...args: unknown[]) => listMock(...args),
}));

import { GET } from "./route";

function makeRequest(search: string): NextRequest {
  return {
    nextUrl: new URL(`https://openspot.test/api/spots/cities${search}`),
  } as unknown as NextRequest;
}

const sample: SpotFacetCity[] = [
  { slug: "bogota", name: "Bogotá" },
  { slug: "medellin", name: "Medellín" },
];

describe("GET /api/spots/cities", () => {
  beforeEach(() => {
    listMock.mockReset();
  });

  it("rejects a missing country", async () => {
    const res = await GET(makeRequest(""));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Country is required" });
    expect(listMock).not.toHaveBeenCalled();
  });

  it("rejects a blank country", async () => {
    const res = await GET(makeRequest("?country=%20%20"));
    expect(res.status).toBe(400);
    expect(listMock).not.toHaveBeenCalled();
  });

  it("returns the server-truth city list for the country", async () => {
    listMock.mockResolvedValue(sample);
    const res = await GET(makeRequest("?country=Colombia"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ country: "Colombia", cities: sample });
    expect(listMock).toHaveBeenCalledWith("Colombia");
  });

  it("tolerates a whitespace-padded country", async () => {
    listMock.mockResolvedValue(sample);
    const res = await GET(makeRequest("?country=%20Colombia%20"));
    expect(listMock).toHaveBeenCalledWith("Colombia");
    expect(res.status).toBe(200);
  });

  it("returns an empty list for a country without spots", async () => {
    listMock.mockResolvedValue([]);
    const res = await GET(makeRequest("?country=Atlantis"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ country: "Atlantis", cities: [] });
  });

  it("never leaks service error details", async () => {
    listMock.mockRejectedValue(new Error("db down"));
    const res = await GET(makeRequest("?country=Colombia"));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Internal error" });
  });
});
