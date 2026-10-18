import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth/server"
import { listRanking } from "@/lib/services/profile/ranking"

export async function GET() {
  try {
    await requireUser()
    return NextResponse.json(await listRanking())
  } catch (error) {
    if (error instanceof Error && error.message === "Not signed in") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
