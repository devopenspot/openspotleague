import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { getEmergencyNumbers } from "@/lib/emergency"
import { log } from "@/lib/utils/log"

const QuerySchema = z.object({
	iso2: z
		.string()
		.regex(/^[A-Z]{2}$/, "Invalid ISO 3166-1 alpha-2 code"),
})

/**
 * Public, latency-critical. No auth gate: the data is public, the
 * payload is small, and the one-tap "Emergency" chip on `/map`
 * must not bounce on a session refresh.
 *
 * The cached service in `getEmergencyNumbers` absorbs >99% of
 * calls per Vercel instance, so the upstream's 5 req/sec ceiling
 * is well above any realistic cold-cache stampede.
 */
export async function GET(request: NextRequest) {
	const url = new URL(request.url)
	const iso2Raw = url.searchParams.get("iso2")
	const parsed = QuerySchema.safeParse({ iso2: iso2Raw })
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid ISO 3166-1 alpha-2 code" },
			{ status: 400 },
		)
	}
	const { iso2 } = parsed.data
	try {
		const data = await getEmergencyNumbers(iso2)
		if (!data) {
			return NextResponse.json(
				{ error: "Upstream unavailable" },
				{ status: 502 },
			)
		}
		const res = NextResponse.json(data)
		// Public per-country data — stable, absorbs /map chip polling.
		res.headers.set("Cache-Control", "public, s-maxage=600, stale-while-revalidate=600")
		return res
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		const isAbort =
			error instanceof Error &&
			(error.name === "AbortError" || error.name === "TimeoutError")
		if (isAbort) {
			log.warn("api.emergency.timeout", { iso2, message })
			return NextResponse.json(
				{ error: "Upstream timed out" },
				{ status: 504 },
			)
		}
		log.warn("api.emergency.unavailable", { iso2, message })
		return NextResponse.json(
			{ error: "Upstream unavailable" },
			{ status: 502 },
		)
	}
}
