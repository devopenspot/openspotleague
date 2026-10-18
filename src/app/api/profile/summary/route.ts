import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth/server"
import { getProfileSummary } from "@/lib/services/profile/profile"

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" }

export async function GET() {
  try {
    const user = await requireUser()
    const summary = await getProfileSummary(user.id)
    return NextResponse.json(summary, { headers: PRIVATE_HEADERS })
  } catch (error) {
    if (error instanceof Error && error.message === "Not signed in") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
