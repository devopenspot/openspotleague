import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/server";
import { listTvDistinctCategories } from "@/lib/services/tv/tv";
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
    const disciplineSlug = searchParams.get("discipline")?.trim().toLowerCase();
    if (!disciplineSlug) {
      return NextResponse.json({ error: "discipline is required" }, { status: 400 });
    }

    // Scoped curators may only read categories of their allowed disciplines.
    const isAdminLike = snapshot.roles.has("admin") || snapshot.roles.has("curator");
    if (!isAdminLike && !snapshot.disciplineScopes.has(disciplineSlug)) {
      return NextResponse.json([], {
        headers: { "Cache-Control": "private, max-age=60" },
      });
    }

    const categories = await listTvDistinctCategories({ disciplineSlug });
    return NextResponse.json(categories, {
      headers: {
        "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    log.error("api.admin.tv.categories.get_failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
