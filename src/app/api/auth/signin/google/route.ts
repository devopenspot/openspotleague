import { NextResponse } from "next/server"
import {
  AuthConfigError,
  configNotReadyResponse,
  originFromRequest,
  sanitizeNext,
  signInWithGoogle,
} from "@/lib/auth/server"

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { next?: unknown }
    | null
  const next = sanitizeNext(body?.next)

  try {
    const { url, error } = await signInWithGoogle({
      origin: originFromRequest(request),
      next,
    })
    if (error || !url) {
      return NextResponse.json(
        { error: error ?? "Failed to start Google sign-in" },
        { status: 400 },
      )
    }
    return NextResponse.json({ url })
  } catch (err) {
    if (err instanceof AuthConfigError) return configNotReadyResponse()
    const message = err instanceof Error ? err.message : "Unexpected error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
