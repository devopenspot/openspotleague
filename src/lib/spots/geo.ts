import type { MapSpot } from "@/lib/types";
import type { DistanceUnit } from "@/stores/preferences-store";
import type { NearbyRadiusMiles } from "@/stores/user-location-store";

const EARTH_RADIUS_KM = 6371;
const MILES_TO_METERS = 1609.344;
const KM_TO_METERS = 1000;

export interface LatLon {
  lat: number;
  lon: number;
}

export function haversineMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const meters = haversineMeters(lat1, lon1, lat2, lon2);
  return meters / MILES_TO_METERS;
}

export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c * KM_TO_METERS;
}

export function metersToUnit(meters: number, unit: DistanceUnit): number {
  return unit === "km" ? meters / KM_TO_METERS : meters / MILES_TO_METERS;
}

export function formatDistanceMiles(miles: number): string {
  if (miles < 10) return `${miles.toFixed(1)} MI AWAY`;
  if (miles < 100) return `${Math.round(miles)} MI AWAY`;
  return `${Math.round(miles / 10) * 10} MI AWAY`;
}

export function formatDistance(meters: number, unit: DistanceUnit): string {
  const value = metersToUnit(meters, unit);
  const suffix = unit === "km" ? "KM AWAY" : "MI AWAY";
  if (value < 10) return `${value.toFixed(1)} ${suffix}`;
  if (value < 100) return `${Math.round(value)} ${suffix}`;
  return `${Math.round(value / 10) * 10} ${suffix}`;
}

export const SPOT_DISTANCE_CTA_LABEL = "DISTANCE";

export type SpotDistanceInfo =
  | { kind: "distance"; label: string; meters: number }
  | { kind: "cta"; label: string };

export function getSpotDistanceInfo(
  spot: Pick<MapSpot, "location">,
  origin: LatLon | null,
  unit: DistanceUnit = "mi",
): SpotDistanceInfo {
  if (origin === null) {
    return { kind: "cta", label: SPOT_DISTANCE_CTA_LABEL };
  }
  const meters = haversineMeters(
    origin.lat,
    origin.lon,
    spot.location.lat,
    spot.location.lon,
  );
  return { kind: "distance", label: formatDistance(meters, unit), meters };
}

export function milesToMeters(miles: number): number {
  return miles * MILES_TO_METERS;
}

export function formatRadiusLabel(
  miles: NearbyRadiusMiles,
  unit: DistanceUnit,
): string {
  if (unit === "km") {
    const km = Math.round(metersToUnit(milesToMeters(miles), "km"));
    return `${km} km`;
  }
  return `${miles} mi`;
}

export function hashToUnitInterval(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return (Math.abs(h) % 1000) / 1000;
}
