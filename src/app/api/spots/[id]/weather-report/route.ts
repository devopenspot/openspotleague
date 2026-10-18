import { NextResponse, type NextRequest } from "next/server"
import { getSpotLastWeatherReport } from "@/lib/services/spot/spot-weather"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!id) return NextResponse.json({ error: "Missing spot id" }, { status: 400 })
  try {
    const report = await getSpotLastWeatherReport(id)
    return NextResponse.json({ report })
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
