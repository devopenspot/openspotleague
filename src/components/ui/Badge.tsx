import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type BadgeTone =
  | "neutral"
  | "info"
  | "accent"
  | "success"
  | "warning"
  | "danger";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  tone?: BadgeTone;
  dot?: boolean;
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral:
    "border-outline-variant bg-surface-container-high text-on-surface-variant",
  info: "border-secondary/30 bg-secondary-container text-on-secondary-container",
  accent: "border-primary/35 bg-primary-container text-on-primary-container",
  success: "border-secondary/30 bg-secondary-container text-on-secondary-container",
  warning: "border-primary/35 bg-primary-container text-on-primary-container",
  danger: "border-error/35 bg-error-container text-on-error-container",
};

const DOT_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-outline",
  info: "bg-secondary",
  accent: "bg-primary",
  success: "bg-secondary",
  warning: "bg-primary",
  danger: "bg-error",
};

export function Badge({
  children,
  className,
  tone = "neutral",
  dot = false,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center gap-1.5 whitespace-nowrap rounded-[8px] border px-2 py-1 font-sans text-xs font-semibold uppercase leading-none tracking-[0.05em]",
        TONE_CLASSES[tone],
        className,
      )}
      {...rest}
    >
      {dot ? (
        <span
          aria-hidden="true"
          className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT_CLASSES[tone])}
        />
      ) : null}
      {children}
    </span>
  );
}
