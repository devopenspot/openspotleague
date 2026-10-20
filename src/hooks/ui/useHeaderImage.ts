"use client";

import { useEffect } from "react";
import { useUIStore } from "@/stores/ui-store";

/**
 * Dynamically set the header logo/branding image while the calling page/component is mounted.
 * Automatically restores the default header logo upon unmount or when image becomes falsy.
 */
export function useHeaderImage(image: string | null | undefined) {
  const setHeaderImage = useUIStore((s) => s.setHeaderImage);

  useEffect(() => {
    if (!image) return;
    setHeaderImage(image);
    return () => {
      setHeaderImage(null);
    };
  }, [image, setHeaderImage]);
}

/**
 * Declarative JSX component to override the header image on a page.
 *
 * Example:
 * ```tsx
 * export default function SponsorEventPage() {
 *   return (
 *     <>
 *       <HeaderImageOverride image="/sponsor-logo.png" />
 *       <main>...</main>
 *     </>
 *   );
 * }
 * ```
 */
export function HeaderImageOverride({ image }: { image: string }) {
  useHeaderImage(image);
  return null;
}
