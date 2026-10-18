import type { TemperatureUnit } from "@/stores/preferences-store";

export function celsiusToFahrenheit(c: number): number {
  return c * 9 / 5 + 32;
}

export function formatTemp(
  celsius: number | null | undefined,
  unit: TemperatureUnit,
): string {
  if (celsius === null || celsius === undefined) return "—";
  if (unit === "F") return `${Math.round(celsiusToFahrenheit(celsius))}°F`;
  return `${Math.round(celsius)}°C`;
}

export function formatTempPair(
  celsiusMin: number | null,
  celsiusMax: number | null,
  unit: TemperatureUnit,
  sep = " / ",
): string {
  if (celsiusMin === null || celsiusMax === null) return "—";
  if (unit === "F") {
    return `${Math.round(celsiusToFahrenheit(celsiusMin))}°${sep}${Math.round(celsiusToFahrenheit(celsiusMax))}°F`;
  }
  return `${Math.round(celsiusMin)}°${sep}${Math.round(celsiusMax)}°C`;
}
