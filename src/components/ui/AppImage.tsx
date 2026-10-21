"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type AppImageProps = Omit<
  React.ComponentProps<typeof Image>,
  "src" | "alt" | "onError"
> & {
  src: string;
  alt: string;
  fallbackSrc?: string;
};

/**
 * Free, private-bucket aware image wrapper.
 * - Keeps `unoptimized` (no Vercel/Supabase paid transform) — variants are pre-generated at upload (128/400/800 WebP)
 * - Handles `onError` fallback to `/opengraph.png` instead of black box
 * - Enforces meaningful `alt` (caller must provide spot/event name, not "")
 * - Supports `priority`/`loading`/`fetchPriority` for LCP control
 */
export function AppImage({
  src,
  alt,
  fallbackSrc = "/opengraph.png",
  unoptimized = true,
  referrerPolicy = "no-referrer",
  ...props
}: AppImageProps & {
  unoptimized?: boolean;
  referrerPolicy?: React.ComponentProps<typeof Image>["referrerPolicy"];
}) {
  const initialSrc = src && src.trim().length > 0 ? src : fallbackSrc;
  const [currentSrc, setCurrentSrc] = useState(initialSrc);
  const [hasError, setHasError] = useState(false);

  if (
    process.env.NODE_ENV !== "production" &&
    (!alt || alt.trim().length === 0)
  ) {
    console.warn(
      "AppImage: alt should be meaningful (e.g. spot.name), not empty. Using fallback.",
    );
  }

  useEffect(() => {
    // Fallback reset when src prop changes (expired signed URL -> new signed
    // URL). Re-apply the empty-src guard: `src` can be "" or null at runtime
    // (spots without a photo), and `next/image` coerces that to an empty
    // string attribute, which makes the browser re-download the page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentSrc(src && src.trim().length > 0 ? src : fallbackSrc);
    setHasError(false);
  }, [src, fallbackSrc]);

  const handleError = () => {
    if (!hasError && currentSrc !== fallbackSrc) {
      setHasError(true);
      setCurrentSrc(fallbackSrc);
    }
  };

  // Ensure alt is never empty for content images
  const safeAlt = alt && alt.trim().length > 0 ? alt : "Spot image";

  return (
    <Image
      src={currentSrc}
      alt={safeAlt}
      onError={handleError}
      unoptimized={unoptimized}
      referrerPolicy={referrerPolicy}
      {...props}
    />
  );
}
