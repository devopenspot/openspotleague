import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isShortLinksEnabled } from "@/lib/config/feature-flags";
import { createShortLink } from "@/lib/services/short-link/short-links";
import { ShortLinkValidationError } from "@/lib/utils/short-code";
import { log } from "@/lib/utils/log";

const CreateShortLinkSchema = z.object({
  url: z.string().min(1).max(2048),
  title: z.string().max(255).optional().nullable(),
});

export async function POST(request: NextRequest): Promise<Response> {
  if (!isShortLinksEnabled()) {
    return NextResponse.json(
      { error: "Short links feature is disabled" },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = CreateShortLinkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation error", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const link = await createShortLink(
      { targetUrl: parsed.data.url, title: parsed.data.title },
      request.nextUrl.origin,
    );

    const shortUrl = `${request.nextUrl.origin}/s/${link.code}`;

    return NextResponse.json({
      code: link.code,
      shortUrl,
      targetUrl: link.targetUrl,
    });
  } catch (err: unknown) {
    if (err instanceof ShortLinkValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    log.error(
      "api.short-links.create_failed",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
