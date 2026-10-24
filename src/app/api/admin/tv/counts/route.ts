import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/server";
import { countTvByDiscipline } from "@/lib/services/tv/tv";
import { log } from "@/lib/utils/log";

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    const { getAuthorizationSnapshotCached, hasTvCuratorRole } = await import(
      "@/lib/services/profile/authorization"
    );
    const snapshot = await getAuthorizationSnapshotCached(user.id);
    if (!hasTvCuratorRole(snapshot)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const disciplineSlug = searchParams.get("discipline")?.trim().toLowerCase() || undefined;

    const counts = await countTvByDiscipline(
      disciplineSlug ? { disciplineSlug, publishedOnly: false } : { publishedOnly: false },
    );

    const countMap: Record<string, number> = {};
    for (const item of counts) {
      countMap[item.disciplineSlug] = item.count;
    }

    return NextResponse.json(countMap, {
      headers: {
        "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    log.error("api.admin.tv.counts.get_failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
