import { NextResponse, type NextRequest } from "next/server";
import { resolveShortLink } from "@/lib/services/short-link/short-links";
import { isValidShortCode } from "@/lib/utils/short-code";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ code: string }> },
): Promise<Response> {
  const { code } = await context.params;

  if (!isValidShortCode(code)) {
    return NextResponse.redirect(new URL("/", request.url), 302);
  }

  const link = await resolveShortLink(code);
  if (!link) {
    return new Response("Short link not found", {
      status: 404,
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=300",
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  const redirectUrl = new URL(link.targetUrl, request.url).toString();

  return new Response(null, {
    status: 307,
    headers: {
      Location: redirectUrl,
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
