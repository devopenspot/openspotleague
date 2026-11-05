import { Trophy } from "lucide-react";
import { AppImage } from "@/components/ui/AppImage";
import { hasContestCover } from "@/lib/league/cover";
import { cn } from "@/lib/utils/cn";
import type { SportDiscipline } from "@/types/disciplines";

interface ContestCoverProps {
  image: string;
  categoryName: string;
  sports: readonly SportDiscipline[];
  sizes: string;
  /** Classes for the photo (object-fit, hover scale, opacity). */
  className?: string;
  priority?: boolean;
  /** Completed contests render quieter. */
  dimmed?: boolean;
}

/**
 * Contest cover inside a sized, `relative` parent. Uploaded covers render as
 * a photo; contests without one get a designed fallback on the League wash
 * (category + disciplines), never the generic OG image.
 */
export function ContestCover({
  image,
  categoryName,
  sports,
  sizes,
  className,
  priority = false,
  dimmed = false,
}: ContestCoverProps) {
  if (hasContestCover(image)) {
    return (
      <AppImage
        src={image}
        alt=""
        fill
        sizes={sizes}
        className={className}
        priority={priority}
        referrerPolicy="no-referrer"
        unoptimized
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      data-contest-cover="fallback"
      className={cn(
        "pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-league text-on-gradient",
        dimmed && "opacity-60 grayscale",
      )}
    >
      <Trophy size={40} strokeWidth={1.5} className="text-on-gradient/80" />
      <p className="px-6 text-center font-display text-sm font-bold uppercase tracking-eyebrow text-on-gradient/80">
        {[categoryName, ...sports].filter(Boolean).join(" · ")}
      </p>
    </div>
  );
}
