import { NextResponse, type NextRequest } from "next/server";
import {
  authorizationErrorResponse,
  getSessionUser,
  requireTvCurationAccess,
} from "@/lib/auth/server";
import { TvVideoInputSchema } from "@/lib/schemas/tv-video";
import {
  deleteTvVideo,
  getTvVideoById,
  updateTvVideo,
} from "@/lib/services/tv/tv";
import { getExpectedUpdatedAt, setUpdatedAtHeaders } from "@/lib/admin/concurrency";
import { isConnectionError, TimeoutError } from "@/lib/db/client";
import { mapMutationErrorResponse } from "@/lib/api/admin-handler";
import { AuthorizationError, getAuthorizationSnapshotCached, hasTvCuratorRole } from "@/lib/services/profile/authorization";
import { log } from "@/lib/utils/log";

function unavailableResponse(): NextResponse {
  return NextResponse.json(
    { error: "The TV service is temporarily unavailable" },
    { status: 503 },
  );
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

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

  const expectedUpdatedAt = getExpectedUpdatedAt(request);
  if (!expectedUpdatedAt) {
    return NextResponse.json({ error: "If-Match is required for edits" }, { status: 428 });
  }

  let user;
  // need discipline for auth — check both existing and target discipline
  try {
    const existing = await getTvVideoById(id);
    if (existing) {
      user = await requireTvCurationAccess(existing.disciplineSlug, "taxonomy.use");
      if (existing.disciplineSlug !== parsed.data.disciplineSlug) {
        user = await requireTvCurationAccess(parsed.data.disciplineSlug, "taxonomy.use");
      }
    } else {
      user = await requireTvCurationAccess(parsed.data.disciplineSlug, "taxonomy.use");
    }
  } catch (error) {
    if (error instanceof TimeoutError || isConnectionError(error)) return unavailableResponse();
    return authorizationErrorResponse(error);
  }

  try {
    const video = await updateTvVideo(id, parsed.data, expectedUpdatedAt, user.id);
    return setUpdatedAtHeaders(NextResponse.json(video), video.updatedAt);
  } catch (error) {
    return mapMutationErrorResponse(error, {
      serviceName: "TV",
      notFoundPrefixes: ["TV video not found"],
      logLabel: "api.admin.tv.update_failed",
      log: log.error,
    });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const expectedUpdatedAt = getExpectedUpdatedAt(request);
  if (!expectedUpdatedAt) {
    return NextResponse.json({ error: "If-Match is required for deletes" }, { status: 428 });
  }

  // Single fail-closed scope check: resolve the row's discipline (or fall back
  // to a TV-curator role check when the row is already gone).
  let user;
  try {
    const existing = await getTvVideoById(id);
    if (existing) {
      user = await requireTvCurationAccess(existing.disciplineSlug, "taxonomy.use");
    } else {
      user = await getSessionUser();
      if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
      const snapshot = await getAuthorizationSnapshotCached(user.id);
      if (!hasTvCuratorRole(snapshot)) {
        return authorizationErrorResponse(new AuthorizationError("FORBIDDEN"));
      }
    }
  } catch (error) {
    if (error instanceof TimeoutError || isConnectionError(error)) return unavailableResponse();
    return authorizationErrorResponse(error);
  }

  try {
    await deleteTvVideo(id, expectedUpdatedAt, user.id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return mapMutationErrorResponse(error, {
      serviceName: "TV",
      notFoundPrefixes: ["TV video not found"],
      logLabel: "api.admin.tv.delete_failed",
      log: log.error,
    });
  }
}
