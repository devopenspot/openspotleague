import { NextResponse } from "next/server"
import {
  authorizationErrorResponse,
  requireCurationAccess,
} from "@/lib/auth/server"
import { listSports } from "@/lib/services/taxonomy/taxonomy"

export async function GET() {
  try {
    await requireCurationAccess("content.read")
  } catch (error) {
    return authorizationErrorResponse(error)
  }
  return NextResponse.json(await listSports())
}
