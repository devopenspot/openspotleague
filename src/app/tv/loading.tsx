import { TvCatalogSkeleton } from "@/components/tv/grid/TvCatalogSkeleton";

export default function TvLoading() {
  return (
    <div className="min-h-dvh">
      <div className="mx-auto max-w-6xl px-0 py-2 md:py-8">
        <TvCatalogSkeleton />
      </div>
    </div>
  );
}
