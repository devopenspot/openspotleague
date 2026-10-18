import { describe, expect, it } from "vitest";
import {
  fractionalTile,
  staticTileLayout,
  TILE_SIZE,
} from "@/lib/map/static-tiles";

describe("fractionalTile", () => {
  it("computes the expected fractional tile for a known coordinate", () => {
    expect(fractionalTile(0, 0, 1)).toEqual({ x: 1, y: 1, fx: 0, fy: 0 });
  });

  it("matches the Web Mercator grid at zoom 16", () => {
    const tile = fractionalTile(40.7128, -74.006, 16);
    expect(tile.x).toBe(19295);
    expect(tile.y).toBe(24640);
  });

  it("keeps fractional parts within the tile", () => {
    const tile = fractionalTile(40.7128, -74.006, 16);
    expect(tile.fx).toBeGreaterThan(0);
    expect(tile.fx).toBeLessThan(1);
    expect(tile.fy).toBeGreaterThan(0);
    expect(tile.fy).toBeLessThan(1);
  });

  it("clamps extreme latitudes to the mercator bounds", () => {
    expect(fractionalTile(89.9, 0, 2).y).toBe(0);
    expect(fractionalTile(-89.9, 0, 2).y).toBe(3);
  });
});

describe("staticTileLayout", () => {
  const WIDTH = 320;
  const HEIGHT = 192;

  // fractionalTile(0, 90, 2) sits at the exact top-left corner of tile (3, 2)
  const CENTERED_SPEC = {
    lat: 0,
    lon: 90,
    zoom: 2,
    width: WIDTH,
    height: HEIGHT,
  };

  it("keeps the tile containing the point anchored at the center", () => {
    const layout = staticTileLayout(CENTERED_SPEC);
    const origin = layout.find((t) => t.x === 3 && t.y === 2);
    expect(origin).toBeDefined();
    expect(origin!.left).toBeCloseTo(WIDTH / 2, 6);
    expect(origin!.top).toBeCloseTo(HEIGHT / 2, 6);
  });

  it("includes the origin tile plus only the intersecting neighbors", () => {
    const layout = staticTileLayout(CENTERED_SPEC);
    expect(layout.map((t) => `${t.x}/${t.y}`).sort()).toEqual([
      "2/1",
      "2/2",
      "3/1",
      "3/2",
    ]);
  });

  it("returns a single tile when the point sits deep inside it", () => {
    // -40.98, 135 lands mid-tile (3, 2) at zoom 2 (fx ≈ fy ≈ 0.5), so a
    // 100x100 container needs no neighbor tiles.
    const layout = staticTileLayout({
      lat: -40.98,
      lon: 135,
      zoom: 2,
      width: 100,
      height: 100,
    });
    expect(layout).toHaveLength(1);
    expect(fractionalTile(-40.98, 135, 2).x).toBe(3);
    expect(fractionalTile(-40.98, 135, 2).fx).toBeCloseTo(0.5, 1);
  });

  it("returns empty for degenerate sizes", () => {
    expect(
      staticTileLayout({
        lat: 0,
        lon: 0,
        zoom: 16,
        width: 0,
        height: 192,
      }),
    ).toEqual([]);
    expect(
      staticTileLayout({
        lat: 0,
        lon: 0,
        zoom: 16,
        width: 320,
        height: 0,
      }),
    ).toEqual([]);
  });

  it("keeps every tile within valid bounds of the zoom level", () => {
    const layout = staticTileLayout({
      lat: 0,
      lon: 0,
      zoom: 2,
      width: 800,
      height: 192,
    });
    for (const t of layout) {
      expect(t.x).toBeGreaterThanOrEqual(0);
      expect(t.x).toBeLessThanOrEqual(3);
      expect(t.y).toBeGreaterThanOrEqual(0);
      expect(t.y).toBeLessThanOrEqual(3);
      expect(t.left).toBeLessThan(800);
      expect(t.left + TILE_SIZE).toBeGreaterThan(0);
      expect(t.top).toBeLessThan(192);
      expect(t.top + TILE_SIZE).toBeGreaterThan(0);
    }
  });
});
