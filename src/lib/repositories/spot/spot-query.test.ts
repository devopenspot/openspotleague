import { describe, expect, it } from "vitest";
import type { JoinedSpotRow, MapSpotRow, SpotCardRow } from "./spot-query";
import {
  rowToMapSpot,
  rowToMapSpotWithImagePath,
  rowToSpot,
  rowToSpotWithImagePath,
  rowToSpotCard,
} from "./spot-query";

const baseRow: JoinedSpotRow = {
  id: "co-1",
  slug: "parque-original",
  name: "Parque Original",
  city: "Bogota",
  citySlug: "bogota",
  address: "calle 1",
  types: [],
  sports: [],
  imageUrl: "https://example.com/photo.webp",
  country: "Colombia",
  countryCode: "CO",
  instagram: null,
  verificationCount: 2,
  visibility: "public",
  origin: "seed",
  communitySubmissionCount: 0,
  adminHidden: false,
  location: { lat: 4.6, lon: -74.06 },
  createdBy: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("rowToSpot image normalization", () => {
  it("normalizes a NULL image_url from the live DB to an empty string", () => {
    const spot = rowToSpot({
      ...baseRow,
      imageUrl: null as unknown as string,
    });

    expect(spot.image).toBe("");
    expect(spot.types).toEqual([]);
  });

  it("keeps an existing image URL", () => {
    const spot = rowToSpot(baseRow);

    expect(spot.image).toBe("https://example.com/photo.webp");
  });

  it("reports a null imagePath when the URL is unusable", () => {
    const { imagePath } = rowToSpotWithImagePath({
      ...baseRow,
      imageUrl: null as unknown as string,
    });

    expect(imagePath).toBeNull();
  });
});

describe("rowToMapSpot", () => {
  const baseMapRow: MapSpotRow = {
    id: "co-1",
    slug: "parque-original",
    name: "Parque Original",
    city: "Bogota",
    citySlug: "bogota",
    types: [{ slug: "plaza", name: "Plaza" }],
    sports: ["Skateboard"],
    imageUrl: "https://example.com/photo.webp",
    country: "Colombia",
    countryCode: "CO",
    instagram: "https://instagram.com/parque",
    verificationCount: 5,
    location: { lat: 4.6, lon: -74.06 },
  };

  it("projects only map/search consumer fields and omits moderation/timestamp fields", () => {
    const spot = rowToMapSpot(baseMapRow);
    expect(spot).toEqual({
      id: "co-1",
      slug: "parque-original",
      name: "Parque Original",
      city: "Bogota",
      citySlug: "bogota",
      types: [{ slug: "plaza", name: "Plaza" }],
      sports: ["Skateboard"],
      image: "https://example.com/photo.webp",
      country: "Colombia",
      countryCode: "CO",
      instagram: "https://instagram.com/parque",
      verificationCount: 5,
      location: { lat: 4.6, lon: -74.06 },
    });
    expect("address" in spot).toBe(false);
    expect("visibility" in spot).toBe(false);
    expect("origin" in spot).toBe(false);
    expect("createdAt" in spot).toBe(false);
    expect("updatedAt" in spot).toBe(false);
  });

  it("normalizes NULL imageUrl and extracts imagePath", () => {
    const { spot, imagePath } = rowToMapSpotWithImagePath({
      ...baseMapRow,
      imageUrl: null,
    });
    expect(spot.image).toBe("");
    expect(imagePath).toBeNull();
  });
});

describe("rowToSpotCard", () => {
  const baseCardRow: SpotCardRow = {
    id: "co-1",
    name: "Parque Original",
    city: "Bogota",
    imageUrl: "https://example.com/photo.webp",
    sports: ["Skateboard"],
  };

  it("projects only the wire fields", () => {
    expect(rowToSpotCard(baseCardRow)).toEqual({
      id: "co-1",
      name: "Parque Original",
      city: "Bogota",
      image: "https://example.com/photo.webp",
      sports: ["Skateboard"],
    });
  });

  it("normalizes a NULL image_url to an empty string", () => {
    const card = rowToSpotCard({ ...baseCardRow, imageUrl: null });
    expect(card.image).toBe("");
  });
});
