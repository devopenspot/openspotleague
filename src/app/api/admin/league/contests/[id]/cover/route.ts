import { NextResponse, type NextRequest } from "next/server"
import { handleCoverClear, handleCoverUpload } from "@/app/api/league/cover-handlers"
import { authorizeCuratorForContest, CURATE_MEDIA } from "../../curator-auth"

/** Curator cover replace (multipart) / clear (JSON), any contest in scope. */

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const user = await authorizeCuratorForContest(id, CURATE_MEDIA)
  if (user instanceof NextResponse) return user
  return handleCoverUpload(request, {
    eventId: id,
    actorId: user.id,
    options: { asCurator: true },
  })
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const user = await authorizeCuratorForContest(id, CURATE_MEDIA)
  if (user instanceof NextResponse) return user
  return handleCoverClear(request, {
    eventId: id,
    actorId: user.id,
    options: { asCurator: true },
  })
}
