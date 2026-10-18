import { NextResponse } from "next/server"
import {
  authorizationErrorResponse,
  requireCurationAccess,
} from "@/lib/auth/server"
import { getAuthorizationSnapshot, hasDisciplineScope, hasRole, hasTrickCuratorRole } from "@/lib/services/profile/authorization"
import { listCurrentTrickCatalogs } from "@/lib/services/taxonomy/trick-catalogs"
import { isConnectionError, TimeoutError } from "@/lib/db/client"
import { log } from "@/lib/utils/log"

export async function GET() {
  let user
  try {
    user = await requireCurationAccess("content.read")
  } catch (error) {
    return authorizationErrorResponse(error)
  }
  const catalogs = await listCurrentTrickCatalogs()
  try {
    const snapshot = await getAuthorizationSnapshot(user.id)
    if (hasRole(snapshot, "admin") || hasRole(snapshot, "curator")) {
      return NextResponse.json(catalogs)
    }
    if (hasTrickCuratorRole(snapshot)) {
      const filtered = catalogs.filter((catalog) => hasDisciplineScope(snapshot, catalog.disciplineSlug))
      return NextResponse.json(filtered)
    }
  } catch (err) {
    if (err instanceof TimeoutError || isConnectionError(err)) {
      return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 })
    }
    log.warn("api.admin.trick_catalogs.snapshot_failed", { error: err instanceof Error ? err.message : err })
    // Fail-closed: do not leak full catalog on authorization store failure
    return NextResponse.json({ error: "Authorization unavailable" }, { status: 503 })
  }
  return NextResponse.json(catalogs)
}
