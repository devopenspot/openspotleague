'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { SpotWeather } from '@/lib/weather/weather-cached';

interface WeatherContextValue {
  weather: Record<string, SpotWeather>;
  getWeather: (id: string) => SpotWeather | undefined;
  /**
   * Populate (or replace) the per-spot weather entry. Called by
   * `useSpotWeather` / `useSpotsWeather` after a client-side
   * `/api/weather` fetch so the rest of the tree (sibling markers,
   * popups) reads the same value without a second round trip.
   */
  setWeather: (id: string, value: SpotWeather) => void;
}

const WeatherCtx = createContext<WeatherContextValue | null>(null);

export function WeatherProvider({
  initialWeather,
  children,
}: {
  initialWeather: Record<string, SpotWeather>;
  children: ReactNode;
}) {
  const [weather, setWeatherState] = useState<Record<string, SpotWeather>>(initialWeather);
  // Stable ref so getWeather does not invalidate on every weather update
  const weatherRef = useRef(weather);
  useEffect(() => {
    weatherRef.current = weather;
  }, [weather]);
  const getWeather = useCallback((id: string) => weatherRef.current[id], []);
  const setWeather = useCallback((id: string, value: SpotWeather) => {
    setWeatherState((prev) => {
      const existing = prev[id];
      if (existing && existing.fetchedAt >= value.fetchedAt) return prev;
      // Shallow clone only when value actually newer — same as before but
      // with stable getWeather the parent does not re-render all consumers
      return { ...prev, [id]: value };
    });
  }, []);
  const value = useMemo<WeatherContextValue>(
    () => ({ weather, getWeather, setWeather }),
    [weather, getWeather, setWeather],
  );
  return <WeatherCtx.Provider value={value}>{children}</WeatherCtx.Provider>;
}

export function useWeather(): WeatherContextValue {
  const ctx = useContext(WeatherCtx);
  if (!ctx) {
    throw new Error('useWeather must be used within a WeatherProvider');
  }
  return ctx;
}
