import { NextResponse, type NextRequest } from "next/server";
import {
  authorizationErrorResponse,
  requireTvCurationAccess,
  getSessionUser,
} from "@/lib/auth/server";
import { TvVideoInputSchema } from "@/lib/schemas/tv-video";
import { createTvVideo, listAllTvVideos, runListTvVideos } from "@/lib/services/tv/tv";
import { log } from "@/lib/utils/log";
import { setUpdatedAtHeaders } from "@/lib/admin/concurrency";
import { isInvalidReferenceError } from "@/lib/repositories/core/errors";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    const { getAuthorizationSnapshotCached, hasTvCuratorRole } = await import("@/lib/services/profile/authorization");
    const snapshot = await getAuthorizationSnapshotCached(user.id);
    if (!hasTvCuratorRole(snapshot)) {
      const { AuthorizationError } = await import("@/lib/services/profile/authorization");
      throw new AuthorizationError("FORBIDDEN");
    }
    // Scoped curators see only their disciplines; admin/curator see all
    const isAdminLike = snapshot.roles.has("admin") || snapshot.roles.has("curator");
    const videos = isAdminLike
      ? await listAllTvVideos()
      : await runListTvVideos({ disciplineSlugs: Array.from(snapshot.disciplineScopes) });
    return NextResponse.json(videos);
  } catch (error) {
    if (error instanceof Error && error.name === "AuthorizationError") {
      const { authorizationErrorResponse } = await import("@/lib/auth/server");
      return authorizationErrorResponse(error);
    }
    log.error("api.admin.tv.get_failed", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = TvVideoInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid TV video", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  let user;
  try {
    user = await requireTvCurationAccess(parsed.data.disciplineSlug, "taxonomy.use");
  } catch (error) {
    return authorizationErrorResponse(error);
  }

  try {
    const video = await createTvVideo(parsed.data, user.id);
    return setUpdatedAtHeaders(NextResponse.json(video, { status: 201 }), video.updatedAt);
  } catch (error) {
    if (isInvalidReferenceError(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    log.error("api.admin.tv.create_failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
