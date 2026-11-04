import { TvCatalogSkeleton } from "@/components/tv/grid/TvCatalogSkeleton";

export default function TvLoading() {
  return (
    <div className="min-h-dvh">
      <div className="mx-auto w-full max-w-6xl">
        <TvCatalogSkeleton />
      </div>
    </div>
  );
}
