import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth/server"
import { getRiderRanking } from "@/lib/services/profile/ranking"

export async function GET() {
  try {
    const user = await requireUser()
    return NextResponse.json(await getRiderRanking(user.id))
  } catch (error) {
    if (error instanceof Error && error.message === "Not signed in") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
