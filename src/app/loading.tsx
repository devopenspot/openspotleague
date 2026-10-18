export default function Loading() {
  // Decoupled: root no longer owns the Hero skeleton.
  // Each main page provides its own skeleton via its segment loading.tsx
  // or Suspense fallback (HomeSkeleton, Explore loading, MapSkeleton, League loading).
  // This prevents double flash: previously root Hero skeleton showed first,
  // then segment skeleton swapped in.
  return null;
}
