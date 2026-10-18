import { cn } from "@/lib/utils/cn";

export type LocationLedStatus =
  | "idle"
  | "requesting"
  | "granted"
  | "denied"
  | "unavailable";

interface LocationLedProps {
  status: LocationLedStatus;
  className?: string;
  size?: number;
}

export function LocationLed({
  status,
  className,
  size = 12,
}: LocationLedProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 12 12"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      aria-hidden="true"
      data-location-led={status}
    >
      <circle
        cx="6"
        cy="6"
        r="5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        className="text-outline"
      />
      <circle
        cx="6"
        cy="6"
        r="2.5"
        className="led__core"
        data-state={status}
      />
    </svg>
  );
}
