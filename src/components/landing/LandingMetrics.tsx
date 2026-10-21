"use client";

import { MapPinned, Globe2, Trophy, Tv } from "lucide-react";

interface MetricItem {
  icon: typeof MapPinned;
  value: string;
  label: string;
  description: string;
}

const METRICS: readonly MetricItem[] = [
  {
    icon: MapPinned,
    value: "26,000+",
    label: "Spots & Parks",
    description: "Curated street ledges, stairs, DIYs & parks worldwide",
  },
  {
    icon: Globe2,
    value: "12",
    label: "Global Regions",
    description: "Covering North America, Europe, LatAm, Oceania & Asia",
  },
  {
    icon: Trophy,
    value: "4",
    label: "Sports Disciplines",
    description: "Skateboarding, BMX Freestyle, Inline & Scooter",
  },
  {
    icon: Tv,
    value: "380+",
    label: "Curated Videos",
    description: "Contest finals, street parts & rider profiles",
  },
] as const;

export function LandingMetrics() {
  return (
    <section
      aria-label="Global scene scale and statistics"
      className="relative z-10 w-full shrink-0 border-b border-outline-variant/60 bg-surface-container-lowest py-8 sm:py-10 px-4 sm:px-6 md:px-10"
    >
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          {METRICS.map((metric) => {
            const Icon = metric.icon;
            return (
              <div
                key={metric.label}
                className="flex flex-col rounded-lg border border-outline-variant/50 bg-surface-container-low/60 p-4 transition-colors hover:border-outline-variant hover:bg-surface-container-low"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-on-primary shadow-xs">
                    <Icon size={16} aria-hidden="true" />
                  </span>
                  <span className="font-display text-xl sm:text-2xl font-extrabold uppercase tracking-tight text-on-surface">
                    {metric.value}
                  </span>
                </div>
                <h3 className="mt-2 font-display text-xs font-bold uppercase tracking-[0.05em] text-on-surface">
                  {metric.label}
                </h3>
                <p className="mt-1 text-[11px] sm:text-xs leading-relaxed text-on-surface-variant">
                  {metric.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
