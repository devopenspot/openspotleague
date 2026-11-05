let started = false;

/**
 * Start downloading the Leaflet canvas chunk ahead of navigation (nav hover,
 * touch or focus). `MapTab` loads the same module through `next/dynamic`, so
 * the chunk is already cached when the map mounts. Runs once per page load.
 */
export function preloadMapCanvas(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  void import("@/components/map/controls/LeafletCanvas").catch(() => {
    // A failed preload is not an error: MapTab retries the import on mount.
    started = false;
  });
}
