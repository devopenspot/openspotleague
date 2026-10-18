import { NextResponse } from "next/server";
import { listTvCardPage, findTvCardById, findTvCardsByIds } from "@/lib/services/tv/tv";
import { TV_CARD_BATCH_MAX } from "@/types/tv";

const TV_PAGE_LIMIT_MAX = 50;
// tvVideos.id is uuid — strict shape keeps malformed ids at 400
// instead of surfacing a DB cast error (500) from inArray.
const TV_ID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const disciplineSlug = searchParams.get("discipline")?.trim() || undefined;
  const category = searchParams.get("category")?.trim() || undefined;
  const id = searchParams.get("id")?.trim() || undefined;
  const idsParam = searchParams.get("ids")?.trim() || undefined;
  const limitParam = searchParams.get("limit")?.trim() || undefined;
  const cursor = searchParams.get("cursor")?.trim() || undefined;

  try {
    // Single public card (theater deep-links, cross-page queue nav).
    if (id) {
      if (!TV_ID_SHAPE.test(id)) {
        return NextResponse.json({ error: "Invalid video id" }, { status: 400 });
      }
      const card = await findTvCardById(id);
      if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const res = NextResponse.json(card);
      res.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
      return res;
    }
    // Batch nav-miss cards (theater boundary walking): one invocation
    // and one Pooler query for up to TV_CARD_BATCH_MAX ids instead of
    // one round-trip per id.
    if (idsParam) {
      const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
      const unique = [...new Set(ids)];
      if (
        unique.length === 0 ||
        unique.length > TV_CARD_BATCH_MAX ||
        unique.some((v) => !TV_ID_SHAPE.test(v))
      ) {
        return NextResponse.json(
          { error: `ids must be 1-${TV_CARD_BATCH_MAX} comma-separated video ids` },
          { status: 400 },
        );
      }
      const cards = await findTvCardsByIds(unique);
      const res = NextResponse.json({ cards });
      res.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
      return res;
    }
    // Deterministic card page (row scroll pagination). Cursor is
    // HMAC-signed; tampered/foreign cursors restart at the first page.
    // publishedOnly is always forced — the previous public toggle
    // (?publishedOnly=false) exposed unpublished rows.
    if (limitParam !== undefined || cursor !== undefined) {
      const limit = Math.min(Math.max(Number(limitParam ?? 12) || 12, 1), TV_PAGE_LIMIT_MAX);
      const page = await listTvCardPage({
        disciplineSlug: disciplineSlug ? disciplineSlug.toLowerCase() : undefined,
        category: category ? category.toLowerCase() : undefined,
        publishedOnly: true,
        limit,
        ...(cursor ? { cursor } : {}),
      });
      const res = NextResponse.json(page);
      res.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
      return res;
    }
    // Full-catalog branch removed — public worst-case transfer and
    // nothing in the UI called it (admin curates via /app/api/admin/tv).
    return NextResponse.json(
      { error: "Missing query — use ?id= or ?limit=&cursor=" },
      { status: 400 },
    );
  } catch (error) {
    console.error("[api/tv] GET failed:", error);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 },
    );
  }
}
