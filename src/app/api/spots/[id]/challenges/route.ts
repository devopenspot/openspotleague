import { NextResponse, type NextRequest } from "next/server"
import { requireUser } from "@/lib/auth/server"
import { listCompletedChallengesForSpot } from "@/lib/services/profile/challenge-history"

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireUser()
    const { id } = await context.params
    return NextResponse.json(await listCompletedChallengesForSpot(id))
  } catch (error) {
    if (error instanceof Error && error.message === "Not signed in") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
