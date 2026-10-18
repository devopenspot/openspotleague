import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type SectionHeaderVariant = "surface" | "inverse";

interface SectionHeaderProps {
  eyebrow?: string;
  eyebrowIcon?: ReactNode;
  title: string;
  titleId?: string;
  description?: string;
  cta?: ReactNode;
  className?: string;
  eyebrowClassName?: string;
  variant?: SectionHeaderVariant;
}

export function SectionHeader({
  eyebrow,
  eyebrowIcon,
  title,
  titleId,
  description,
  cta,
  className,
  eyebrowClassName,
  variant = "surface",
}: SectionHeaderProps) {
  const textClassName = variant === "inverse" ? "text-surface" : "text-on-surface";

  return (
    <div
      className={cn(
        "flex items-end justify-between gap-4 pl-4 md:pl-0",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        {eyebrow && (
          <div className="mb-2 flex items-center gap-2">
            {eyebrowIcon}
            <span
              className={cn(
                "font-display text-xs font-bold uppercase leading-tight tracking-[0.05em]",
                eyebrowClassName,
              )}
            >
              {eyebrow}
            </span>
          </div>
        )}
        <h2
          id={titleId}
          className={cn(
            "font-display text-xl font-bold uppercase leading-tight tracking-tight md:text-[32px] md:leading-[1.3]",
            textClassName,
          )}
        >
          {title}
        </h2>
        {description && (
          <p
            className={cn(
              "mt-2 max-w-xl text-sm leading-relaxed",
              variant === "inverse"
                ? "text-surface/85"
                : "text-on-surface-variant",
            )}
          >
            {description}
          </p>
        )}
      </div>
      {cta && <div className="shrink-0">{cta}</div>}
    </div>
  );
}
