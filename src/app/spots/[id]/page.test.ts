import { beforeEach, describe, expect, it, vi } from "vitest";

const { findSpotByIdMock, getSpotWeatherMock } = vi.hoisted(() => ({
  findSpotByIdMock: vi.fn(),
  getSpotWeatherMock: vi.fn(),
}));

vi.mock("next/server", () => ({
  connection: vi.fn(),
}));

vi.mock("@/lib/services/spot/spots", () => ({
  findSpotById: (...args: unknown[]) => findSpotByIdMock(...args),
}));

vi.mock("@/lib/weather/weather-cached", () => ({
  getSpotWeather: (...args: unknown[]) => getSpotWeatherMock(...args),
}));

import { generateMetadata } from "./page";
import { env } from "@/lib/config/env";

beforeEach(() => {
  vi.resetAllMocks();
  getSpotWeatherMock.mockResolvedValue({
    icon: "sunny",
    description: "clear sky",
    current: 22,
  });
});

describe("spot metadata", () => {
  it("uses the spot image directly for social previews", async () => {
    findSpotByIdMock.mockResolvedValue({
      id: "spot-1",
      name: "Riverside Bowl",
      image: "https://images.example.com/riverside-bowl.jpg",
      types: [{ name: "Bowl" }],
      city: "Lisbon",
      country: "Portugal",
      location: { lat: 38.7, lon: -9.1 },
    });

    const result = await generateMetadata({
      params: Promise.resolve({ id: "spot-1" }),
    });

    expect(result.openGraph).toMatchObject({
      images: [
        {
          url: "https://images.example.com/riverside-bowl.jpg",
          alt: "Riverside Bowl",
        },
      ],
    });
    expect(result.twitter).toMatchObject({
      images: ["https://images.example.com/riverside-bowl.jpg"],
    });
    expect(result.openGraph?.description).toContain("Sunny");
    expect(findSpotByIdMock).toHaveBeenCalledWith("spot-1");
  });

  it("falls back to the absolute default OG image when the spot is imageless", async () => {
    findSpotByIdMock.mockResolvedValue({
      id: "spot-2",
      name: "Imageless Ledge",
      image: "",
      types: [{ name: "Ledge" }],
      city: "Lisbon",
      country: "Portugal",
      location: { lat: 38.7, lon: -9.1 },
    });

    const result = await generateMetadata({
      params: Promise.resolve({ id: "spot-2" }),
    });
    const expected = new URL("/opengraph.png", env.APP_URL).toString();

    expect(result.openGraph).toMatchObject({
      images: [{ url: expected, alt: "Imageless Ledge" }],
    });
    expect(result.twitter).toMatchObject({ images: [expected] });
  });

  it("falls back to the absolute default OG image when the spot is unavailable", async () => {
    findSpotByIdMock.mockResolvedValue(null);

    const result = await generateMetadata({
      params: Promise.resolve({ id: "missing" }),
    });
    const expected = new URL("/opengraph.png", env.APP_URL).toString();

    expect(result.openGraph).toMatchObject({
      images: [{ url: expected, alt: "OpenSpot League" }],
    });
  });
});
