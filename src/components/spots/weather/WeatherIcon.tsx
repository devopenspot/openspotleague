'use client';

import { Sun, CloudSun, Cloud, CloudRain, CloudSnow } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { WeatherIconName } from '@/lib/types';

interface WeatherIconProps {
  name: WeatherIconName;
  size?: number;
  className?: string;
}

const ICONS: Record<
  WeatherIconName,
  { Icon: typeof Sun; className: string; spin: boolean }
> = {
  sunny: { Icon: Sun, className: 'text-permission-pending', spin: true },
  partly_cloudy_day: { Icon: CloudSun, className: 'text-secondary', spin: false },
  cloudy: { Icon: Cloud, className: 'text-secondary', spin: false },
  rain: { Icon: CloudRain, className: 'text-secondary', spin: false },
  snow: { Icon: CloudSnow, className: 'text-on-surface-variant', spin: false },
};

export function WeatherIcon({ name, size = 20, className }: WeatherIconProps) {
  const { Icon, className: color, spin } = ICONS[name] ?? ICONS.sunny;
  return (
    <Icon
      size={size}
      aria-hidden="true"
      className={cn(color, spin && 'animate-spin-slow', className)}
    />
  );
}

const GLYPH_PATHS: Record<WeatherIconName, string> = {
  sunny:
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m4.93 19.07 1.41-1.41"/><path d="m17.66 6.34 1.41-1.41"/>',
  partly_cloudy_day:
    '<circle cx="9" cy="9" r="3"/><path d="M9 2v1"/><path d="M9 16v1"/><path d="M3 9h1"/><path d="M14 9h1"/><path d="m4.5 4.5 .7 .7"/><path d="m12.8 12.8 .7 .7"/><path d="M16 16a4 4 0 0 1 4 4H9a4 4 0 0 1 0-8h.5"/>',
  cloudy:
    '<path d="M17 18a4 4 0 0 0 0-8 6 6 0 0 0-11.5 2"/><path d="M7 18a4 4 0 0 1-1-7.9"/><path d="M22 18H4"/>',
  rain:
    '<path d="M17 14a4 4 0 0 0 0-8 6 6 0 0 0-11.5 2"/><path d="M7 14a4 4 0 0 1-1-7.9"/><path d="M8 18v2"/><path d="M12 18v2"/><path d="M16 18v2"/>',
  snow:
    '<path d="M17 14a4 4 0 0 0 0-8 6 6 0 0 0-11.5 2"/><path d="M7 14a4 4 0 0 1-1-7.9"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/><path d="M10 20h.01"/><path d="M14 20h.01"/>',
};

export function weatherIconGlyph(name: WeatherIconName, size = 12): string {
  const paths = GLYPH_PATHS[name] ?? GLYPH_PATHS.sunny;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ` +
    `width="${size}" height="${size}" fill="none" stroke="currentColor" ` +
    `stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" ` +
    `aria-hidden="true">${paths}</svg>`
  );
}
