import type { WeatherIconName } from "@/lib/types";

export const WEATHER_ICON_NAMES = [
  "sunny",
  "partly_cloudy_day",
  "cloudy",
  "rain",
  "snow",
] as const satisfies readonly WeatherIconName[];

export function isWeatherIconName(value: string | null | undefined): value is WeatherIconName {
  return (WEATHER_ICON_NAMES as readonly string[]).includes(value as string);
}
