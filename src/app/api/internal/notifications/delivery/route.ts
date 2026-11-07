import { NextResponse, type NextRequest } from "next/server"
import { DeliveryReportSchema } from "@/lib/notifications/delivery/contract"
import { applyDeliveryReports } from "@/lib/notifications/delivery/service"
import { log } from "@/lib/utils/log"
import { readSignedBody } from "../signed"

/**
 * Delivery outcomes from the AWS Lambdas: `sent` / `failed` per email job,
 * and SES bounce / complaint feedback that suppresses an address.
 */
export async function POST(request: NextRequest) {
  const signed = await readSignedBody(request)
  if ("response" in signed) return signed.response
  let json: unknown
  try {
    json = JSON.parse(signed.body)
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 })
  }
  const parsed = DeliveryReportSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 })
  }
  try {
    return NextResponse.json(await applyDeliveryReports(parsed.data), {
      headers: { "cache-control": "no-store" },
    })
  } catch (error) {
    log.error("notifications.delivery_report_failed", error)
    return NextResponse.json({ error: "REPORT_FAILED" }, { status: 500 })
  }
}
