import type { WeatherIconName } from "@/lib/types";

const OG_DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
const OG_MONTH_NAMES = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
] as const;

export function formatOgDate(d: Date): string {
  const day = OG_DAY_NAMES[d.getDay()] ?? "MON";
  const month = OG_MONTH_NAMES[d.getMonth()] ?? "JAN";
  const dayOfMonth = String(d.getDate()).padStart(2, "0");
  return `${day} · ${dayOfMonth} ${month} ${d.getFullYear()}`;
}

export function formatOgDateFromString(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return formatOgDate(d);
}

export function formatGameDate(input: {
  scheduledStartAt: string | Date | null;
  createdAt?: string | Date | null;
  timezone?: string | null;
}): string {
  const raw = input.scheduledStartAt ?? input.createdAt ?? null;
  if (!raw) return formatOgDate(new Date());
  const d = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(d.getTime())) return formatOgDate(new Date());
  // We intentionally use local date parts (getDay etc.) so the formatted
  // date is stable regardless of server TZ variance — matches previous
  // spots/[id] implementation. Timezone is kept for future per-TZ rendering.
  return formatOgDate(d);
}

const WEATHER_LABELS: Record<WeatherIconName, string> = {
  sunny: "Sunny",
  partly_cloudy_day: "Partly cloudy",
  cloudy: "Cloudy",
  rain: "Rain",
  snow: "Snow",
};

export function weatherIconLabel(icon: string | null | undefined): string | null {
  if (!icon) return null;
  const key = icon as WeatherIconName;
  return WEATHER_LABELS[key] ?? icon;
}

export interface WeatherLabelInput {
  icon: string | null | undefined;
  description?: string | null | undefined;
  temp?: number | null | undefined;
}

export function buildWeatherLabel(input: WeatherLabelInput | null | undefined): string | null {
  if (!input || !input.icon) return null;
  const label = weatherIconLabel(input.icon) ?? input.icon;
  const parts: string[] = [label];
  if (typeof input.temp === "number" && Number.isFinite(input.temp)) {
    parts.push(`${Math.round(input.temp)}°C`);
  } else if (input.description) {
    const desc = input.description.trim();
    if (desc && desc.toLowerCase() !== label.toLowerCase()) {
      parts.push(desc);
    }
  }
  return parts.join(" · ");
}

export function buildSpotDescription(input: {
  types: readonly { name: string }[];
  city: string | null | undefined;
  country: string | null | undefined;
  dateLabel: string;
  weatherLabel: string | null;
}): string {
  const typeList = input.types.map((t) => t.name).join(", ");
  const locationLabel = [input.city, input.country].filter(Boolean).join(", ");
  return [typeList, locationLabel, input.dateLabel, input.weatherLabel].filter(Boolean).join(" · ");
}

export function buildGameTitle(input: { mode: "challenge" | "training"; gameName: string; host: string }): string {
  const prefix = input.mode === "challenge" ? "Challenge" : "Training";
  return `${prefix} · ${input.gameName} — hosted by ${input.host}`;
}

export function buildGameDescription(input: {
  mode: "challenge" | "training";
  spotName: string | null;
  dateLabel: string;
  weatherLabel: string | null;
  host: string;
}): string {
  const kind = input.mode === "challenge" ? "Challenge" : "Training";
  return [kind, input.spotName ? `@ ${input.spotName}` : null, `Host ${input.host}`, input.dateLabel, input.weatherLabel]
    .filter(Boolean)
    .join(" · ");
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}
