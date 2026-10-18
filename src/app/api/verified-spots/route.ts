import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { requireUser } from "@/lib/auth/server"
import {
  countVerificationsForSpot,
  isVerified,
  verifySpotForUser,
} from "@/lib/services/spot/verified-spots"
import { log } from "@/lib/utils/log"

const PostBody = z
  .object({
    spotId: z.string().min(1),
  })
  .strict()

const GetQuery = z
  .object({
    spotId: z.string().min(1),
  })
  .strict()

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const parsed = GetQuery.safeParse({ spotId: url.searchParams.get("spotId") })
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const { spotId } = parsed.data
  try {
    // The count is cached (per-spot tag). The per-user `isVerified`
    // check is live — see the comment in `services/verified-spots.ts`.
    // An unauthenticated read returns `null` for the boolean; the
    // public count is always served.
    const user = await requireUser().catch(() => null)
    const [count, userVerified] = await Promise.all([
      countVerificationsForSpot(spotId),
      user ? isVerified(user.id, spotId) : Promise.resolve(null),
    ])
    return NextResponse.json({ spotId, count, isVerified: userVerified })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error"
    if (msg.startsWith("Spot not found")) {
      return NextResponse.json({ error: msg }, { status: 404 })
    }
    log.error("api.verified_spots.get_failed", msg)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  let user
  try {
    user = await requireUser()
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unauthorized"
    log.warn("api.verified_spots.post_unauthorized", msg)
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
    const count = await verifySpotForUser(user.id, parsed.data.spotId)
    return NextResponse.json({ ok: true, count, isVerified: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error"
    if (msg.startsWith("Spot not found")) {
      return NextResponse.json({ error: msg }, { status: 404 })
    }
    log.error("api.verified_spots.verify_failed", msg)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
