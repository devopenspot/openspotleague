import { NextResponse, type NextRequest } from "next/server"
import { requireUser } from "@/lib/auth/server"
import { listSavedSpotsForUser, saveSpotForUser } from "@/lib/services/spot/saved-spots"
import { log } from "@/lib/utils/log"
import { z } from "zod"

const PostBody = z
  .object({
    spotId: z.string().min(1),
  })
  .strict()

export async function GET() {
  let user
  try {
    user = await requireUser()
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unauthorized"
    log.warn("api.saved_spots.get_unauthorized", msg)
    return NextResponse.json({ error: msg }, { status: 401 })
  }
  try {
    const result = await listSavedSpotsForUser(user.id, { limit: 200 })
    return NextResponse.json(result)
  } catch (err) {
    log.error(
      "api.saved_spots.list_failed",
      err instanceof Error ? err.message : err,
    )
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  let user
  try {
    user = await requireUser()
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unauthorized"
    log.warn("api.saved_spots.post_unauthorized", msg)
    return NextResponse.json({ error: msg }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = PostBody.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  try {
    await saveSpotForUser(user.id, parsed.data.spotId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error"
    if (msg.startsWith("Spot not found")) {
      return NextResponse.json({ error: msg }, { status: 404 })
    }
    log.error("api.saved_spots.save_failed", msg)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
