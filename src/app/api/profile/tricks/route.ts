import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth/server"
import { getProfileTricks } from "@/lib/services/profile/profile"

export async function GET() {
  try {
    const user = await requireUser()
    const data = await getProfileTricks(user.id)
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    if (error instanceof Error && error.message === "Not signed in") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
