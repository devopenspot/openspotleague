export class WeatherConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WeatherConfigError";
  }
}

export class OpenWeatherRateLimitError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "OpenWeatherRateLimitError";
    this.status = status;
  }
}

// Human-readable cadence label shown by `WeatherAccuracyNote`.
// Mirrors `WEATHER_CACHE_LIFE.revalidate` in `weather-cached.ts` so the
// copy cannot drift from the actual cache TTL. Kept here (no `next/cache`
// import) so client components can import the string without pulling in
// the cached module.
export const WEATHER_REVALIDATE_LABEL = "Updated every 2 hours.";
