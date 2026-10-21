import { Info } from "lucide-react";
import { InfoPopover } from "@/components/feedback/InfoPopover";
import { WEATHER_REVALIDATE_LABEL } from "@/lib/weather/types";
import { cn } from "@/lib/utils/cn";

interface WeatherAccuracyNoteProps {
  variant: "block" | "compact";
  className?: string;
}

export function WeatherAccuracyNote({
  variant,
  className,
}: WeatherAccuracyNoteProps) {
  if (variant === "block") {
    return (
      <p
        role="note"
        data-testid="weather-accuracy-note-block"
        className={cn(
          "flex items-center gap-1.5 font-display text-[9px] font-bold tracking-widest text-secondary uppercase pb-2",
          className,
        )}
      >
        <Info size={12} aria-hidden="true" className="shrink-0" />
        <span>{WEATHER_REVALIDATE_LABEL}</span>
      </p>
    );
  }

  return (
    <InfoPopover
      triggerLabel="Forecast accuracy"
      trigger={<Info size={10} aria-hidden="true" className="text-secondary" />}
      panelClassName={cn("w-56", className)}
    >
      <p className="font-display text-[9px] tracking-wider text-secondary uppercase mb-1.5">
        Forecast accuracy
      </p>
      <p className="text-[10px] font-medium leading-relaxed text-on-surface">
        {WEATHER_REVALIDATE_LABEL}
      </p>
    </InfoPopover>
  );
}
