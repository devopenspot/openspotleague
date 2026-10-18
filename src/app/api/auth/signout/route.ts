import { NextResponse, type NextRequest } from "next/server"
import { AuthConfigError, configNotReadyResponse, signOut } from "@/lib/auth/server"

function originMatchesRequest(request: NextRequest): boolean {
  const origin = request.headers.get("origin")
  if (!origin) return false
  try {
    return new URL(request.url).origin === origin
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  if (!originMatchesRequest(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  try {
    const { error } = await signOut()
    if (error) {
      return NextResponse.json({ error }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof AuthConfigError) return configNotReadyResponse()
    const message = err instanceof Error ? err.message : "Unexpected error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
