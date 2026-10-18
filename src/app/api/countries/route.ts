import { NextResponse } from "next/server"
import { z } from "zod"
import { listCountries } from "@/lib/services/spot/countries"
import { log } from "@/lib/utils/log"

const QuerySchema = z.object({
  q: z
    .string()
    .max(64, "Query too long")
    .optional()
    .transform((v) => v ?? ""),
})

export async function GET(request: Request) {
  const url = new URL(request.url)
  const parsed = QuerySchema.safeParse({ q: url.searchParams.get("q") ?? "" })
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten() },
      { status: 400 },
    )
  }
  try {
    const { items } = await listCountries(parsed.data.q)
    const res = NextResponse.json({ items })
    // Public taxonomy — stable, safe to cache longer.
    res.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600")
    return res
  } catch (err) {
    log.error(
      "api.countries.list_failed",
      err instanceof Error ? err.message : err,
    )
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
