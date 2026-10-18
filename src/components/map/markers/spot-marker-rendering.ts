import type { WeatherIconName } from "@/lib/types";
import type { SpotWeather } from "@/lib/weather/weather-cached";
import type { TemperatureUnit } from "@/stores/preferences-store";
import { weatherIconGlyph } from "@/components/spots/weather/WeatherIcon";
import { formatTemp } from "@/lib/weather/format";

const LABEL_MAX_CHARS = 14;

export interface BuildPinOptions {
  active: boolean;
  saved: boolean;
  showDistance: boolean;
  weather: WeatherIconName | null;
  tempLabel: string;
  distanceLabel: string;
  name: string;
}

export interface PinDimensions {
  size: [number, number];
  anchor: [number, number];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function truncateLabel(name: string): string {
  if (name.length <= LABEL_MAX_CHARS) return name;
  return `${name.slice(0, LABEL_MAX_CHARS - 1).trimEnd()}…`;
}

function classNames(classes: readonly string[]): string {
  return classes.join(" ");
}

function pinClasses(options: BuildPinOptions): string {
  const classes = ["leaflet-pin"];
  if (options.active) classes.push("leaflet-pin--active");
  if (options.saved) classes.push("leaflet-pin--saved");
  return classNames(classes);
}

function weatherMarkup(options: BuildPinOptions): string {
  const glyph = options.weather
    ? weatherIconGlyph(options.weather, 24)
    : "";
  return options.weather ? `<span class="leaflet-pin__weather">${glyph}</span>` : "";
}

export function buildSpotPinHTML(options: BuildPinOptions): string {
  const name = escapeHtml(truncateLabel(options.name));
  const distance = options.showDistance
    ? `<span class="leaflet-pin__row leaflet-pin__distance">${escapeHtml(options.distanceLabel)}</span>`
    : "";
  const weather = options.weather
    ? `<span class="leaflet-pin__row leaflet-pin__conditions">` +
      weatherMarkup(options) +
      `<span class="leaflet-pin__temp">${escapeHtml(options.tempLabel)}</span>` +
      `</span>`
    : "";
  const width = options.weather && options.showDistance
    ? options.active
      ? "w-[104px] sm:w-[116px] md:w-[120px]"
      : "w-[88px] sm:w-[100px] md:w-[108px]"
    : options.weather
      ? options.active
        ? "w-[64px] sm:w-[72px] md:w-[80px]"
        : "w-[60px] sm:w-[68px] md:w-[72px]"
      : "";

  return (
    `<div class="${pinClasses(options)}">` +
    `<div class="leaflet-pin__surface${options.weather ? " leaflet-pin__surface--weather" : ""} px-1${width ? ` ${width}` : ""}">` +
    `<span class="leaflet-pin__row leaflet-pin__label">${name}</span>` +
    distance +
    weather +
    `</div>` +
    `</div>`
  );
}

export function getPinDimensions(
  active: boolean,
  showWeather: boolean,
  showDistance: boolean,
): PinDimensions {
  if (showWeather && showDistance) {
    return active
      ? { size: [120, 76], anchor: [60, 76] }
      : { size: [108, 72], anchor: [54, 72] };
  }
  if (showWeather) {
    return active
      ? { size: [80, 56], anchor: [40, 56] }
      : { size: [72, 50], anchor: [36, 50] };
  }
  if (showDistance) {
    return active
      ? { size: [80, 36], anchor: [40, 36] }
      : { size: [64, 32], anchor: [32, 32] };
  }
  return active
    ? { size: [80, 24], anchor: [40, 24] }
    : { size: [64, 24], anchor: [32, 24] };
}

export function pinOptionsFromWeather(
  options: Omit<BuildPinOptions, "weather" | "tempLabel">,
  weather: SpotWeather | undefined,
  temperatureUnit: TemperatureUnit,
): BuildPinOptions {
  return {
    ...options,
    weather: weather?.icon ?? null,
    tempLabel: formatTemp(weather?.current ?? null, temperatureUnit),
  };
}
