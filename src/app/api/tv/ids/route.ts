import { NextResponse } from "next/server";
import { listTvIdList } from "@/lib/services/tv/tv";

/**
 * Ordered queue IDs for theater navigation across unloaded row pages.
 * IDs only (same order as card pages), filter-keyed and CDN-cached.
 * Covered by the proxy `/api/tv` rate-limit tier.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const disciplineSlug = searchParams.get("discipline")?.trim() || undefined;
  const category = searchParams.get("category")?.trim() || undefined;

  try {
    const ids = await listTvIdList({
      disciplineSlug: disciplineSlug ? disciplineSlug.toLowerCase() : undefined,
      category: category ? category.toLowerCase() : undefined,
      publishedOnly: true,
    });
    const res = NextResponse.json({ ids, total: ids.length });
    res.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    return res;
  } catch (error) {
    console.error("[api/tv/ids] GET failed:", error);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 },
    );
  }
}
