// Static OSM tile math for imageless spot cards.
// Coordinates are fractional tile indices on the standard Web Mercator
// grid (zoom level `zoom`, tile size 256px), the same grid Leaflet's
// TileLayer uses, so fallback maps stay visually consistent with the
// app's map views.

export const TILE_SIZE = 256;

const MERCATOR_MAX_LAT = 85.05112878;

export interface FractionalTile {
  x: number;
  y: number;
  fx: number;
  fy: number;
}

export interface StaticTileSpec {
  lat: number;
  lon: number;
  zoom: number;
  width: number;
  height: number;
}

export interface PositionedTile {
  x: number;
  y: number;
  left: number;
  top: number;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function wrapLon(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function fractionalTile(
  lat: number,
  lon: number,
  zoom: number,
): FractionalTile {
  const n = 2 ** zoom;
  const clampedLat = clamp(lat, -MERCATOR_MAX_LAT, MERCATOR_MAX_LAT);
  const xf = ((wrapLon(lon) + 180) / 360) * n;
  const latRad = toRad(clampedLat);
  const yf =
    ((1 -
      Math.log(
        Math.tan(latRad) + 1 / Math.cos(latRad),
      ) / Math.PI)) /
    2 *
    n;

  const x = clamp(Math.floor(xf), 0, n - 1);
  const y = clamp(Math.floor(yf), 0, n - 1);

  return {
    x,
    y,
    fx: clamp(xf - x, 0, 1),
    fy: clamp(yf - y, 0, 1),
  };
}

export function staticTileLayout(spec: StaticTileSpec): PositionedTile[] {
  const { lat, lon, zoom, width, height } = spec;
  if (!(width > 0) || !(height > 0)) return [];

  const n = 2 ** zoom;
  const { x, y, fx, fy } = fractionalTile(lat, lon, zoom);

  const originLeft = width / 2 - fx * TILE_SIZE;
  const originTop = height / 2 - fy * TILE_SIZE;
  const sweepX = Math.ceil(width / 2 / TILE_SIZE) + 1;
  const sweepY = Math.ceil(height / 2 / TILE_SIZE) + 1;

  const tiles: PositionedTile[] = [];
  for (let dy = -sweepY; dy <= sweepY; dy++) {
    const ty = y + dy;
    if (ty < 0 || ty > n - 1) continue;
    const top = originTop + dy * TILE_SIZE;
    if (top >= height || top + TILE_SIZE <= 0) continue;
    for (let dx = -sweepX; dx <= sweepX; dx++) {
      const tx = x + dx;
      if (tx < 0 || tx > n - 1) continue;
      const left = originLeft + dx * TILE_SIZE;
      if (left >= width || left + TILE_SIZE <= 0) continue;
      tiles.push({ x: tx, y: ty, left, top });
    }
  }
  return tiles;
}
