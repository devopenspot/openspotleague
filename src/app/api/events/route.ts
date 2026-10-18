import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { toMarqueeEvent } from "@/components/landing/marquee-data"
import { SportEventQuerySchema } from "@/lib/schemas/event"
import { listEvents } from "@/lib/services/event/events"
import { log } from "@/lib/utils/log"

// `limit` arrives as a query string (always a string), and
// `SportEventQuerySchema` requires `z.number()`. We coerce here
// rather than at the schema level so the schema stays a single
// source of truth for the domain contract.
const Query = z
  .object({
    q: SportEventQuerySchema.shape.q,
    country: SportEventQuerySchema.shape.country,
    citySlug: SportEventQuerySchema.shape.citySlug,
    category: SportEventQuerySchema.shape.category,
    discipline: SportEventQuerySchema.shape.discipline,
    featured: z
      .string()
      .optional()
      .transform((v, ctx) => {
        if (v === undefined || v === "true" || v === "1") return v === undefined ? undefined : true
        if (v === "false" || v === "0") return false
        ctx.addIssue({ code: "custom", message: "featured must be true or false" })
        return z.NEVER
      }),
    from: SportEventQuerySchema.shape.from,
    to: SportEventQuerySchema.shape.to,
    cursor: SportEventQuerySchema.shape.cursor,
    seed: SportEventQuerySchema.shape.seed,
    random: z
      .string()
      .optional()
      .transform((v) => {
        if (v === undefined) return undefined
        if (v === "true" || v === "1") return true
        if (v === "false" || v === "0") return false
        return v as unknown as boolean
      })
      .pipe(SportEventQuerySchema.shape.random),
    limit: z
      .string()
      .optional()
      .transform((v) => (v ? Number(v) : undefined))
      .pipe(SportEventQuerySchema.shape.limit),
  })
  .strict()

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const raw: Record<string, string> = {}
  for (const [k, v] of url.searchParams.entries()) raw[k] = v

  const parsed = Query.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  try {
    const events = await listEvents(parsed.data)
    const body =
      parsed.data.random && Array.isArray(events?.items)
        ? { ...events, items: events.items.map(toMarqueeEvent) }
        : events
    const res = NextResponse.json(body)
    // Public directory read — CDN absorbs polling. Varies on query string only.
    res.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300")
    return res
  } catch (err) {
    log.error(
      "api.events.list_failed",
      err instanceof Error ? err.message : err,
    )
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
