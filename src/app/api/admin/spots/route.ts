import { NextResponse, type NextRequest } from "next/server";
import {
  authorizationErrorResponse,
  requireCurationAccess,
  requireSpotCurationAccess,
} from "@/lib/auth/server";
import { NewSpotSchema } from "@/lib/schemas/spot";
import { createSpot } from "@/lib/services/spot/spots";
import { UploadValidationError, deleteSpotImage, uploadSpotImage, uploadSpotImageFromUrl } from "@/lib/storage";
import { mapMutationErrorResponse } from "@/lib/api/admin-handler";
import { log } from "@/lib/utils/log";
import { isConnectionError, TimeoutError } from "@/lib/db/client";
import { setUpdatedAtHeaders } from "@/lib/admin/concurrency";

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireCurationAccess(["content.write", "media.manage"]);
  } catch (err) {
    return authorizationErrorResponse(err);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data" },
      { status: 400 },
    );
  }

  const fileEntry = form.get("image");
  const file =
    fileEntry instanceof File && fileEntry.size > 0 ? fileEntry : null;

  const rawExternalUrlEntry = form.get("imageUrl");
  const rawExternalUrl =
    typeof rawExternalUrlEntry === "string" ? rawExternalUrlEntry.trim() : "";

  let providedId: string | undefined;
  let imagePath: string | null = null;
  let imageUrl = "";
  if (file) {
    try {
      providedId = crypto.randomUUID();
      const uploaded = await uploadSpotImage(file, providedId);
      imagePath = uploaded.path;
      imageUrl = uploaded.url;
    } catch (err) {
      log.error(
        "api.admin.spots.upload_failed",
        err instanceof Error ? err.message : "Image upload failed",
      );
      if (err instanceof UploadValidationError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      if (err instanceof TimeoutError || isConnectionError(err)) {
        return NextResponse.json({ error: "Storage is temporarily unavailable" }, { status: 503 });
      }
      return NextResponse.json(
        { error: "Image upload failed" },
        { status: 502 },
      );
    }
  } else if (rawExternalUrl) {
    // Ingest remote URL: fetch, validate, transform to WebP variants, store in
    // Supabase Storage (same pipeline as file upload). Do not persist hotlink.
    // Skip empty or placeholder URLs (the latter is internal only).
    const isPlaceholder = rawExternalUrl.includes("placeholder.local");
    // Only attempt ingest for http(s) URLs; other values will be caught by zod validation
    const isHttpUrl = /^https?:\/\//i.test(rawExternalUrl);
    if (isHttpUrl && !isPlaceholder) {
      try {
        providedId = crypto.randomUUID();
        const uploaded = await uploadSpotImageFromUrl(rawExternalUrl, providedId);
        imagePath = uploaded.path;
        imageUrl = uploaded.url;
      } catch (err) {
        log.error("api.admin.spots.remote_upload_failed", err instanceof Error ? err.message : "Image upload failed");
        if (err instanceof UploadValidationError) {
          return NextResponse.json({ error: err.message }, { status: 400 });
        }
        if (err instanceof TimeoutError || isConnectionError(err)) {
          return NextResponse.json({ error: "Storage is temporarily unavailable" }, { status: 503 });
        }
        return NextResponse.json({ error: "Image upload failed" }, { status: 502 });
      }
    }
  }

  const strField = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" ? v : "";
  };
  const numField = (k: string) => {
    const value = strField(k).trim();
    if (!value) return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  };
  const strListField = (k: string) =>
    form.getAll(k).filter((v): v is string => typeof v === "string");

  const country = strField("country");
  const countryCode = strField("countryCode").toUpperCase();
  const instagramRaw = strField("instagram").trim();
  // Empty form input → DB `null`. The Zod schema only accepts a valid
  // URL or `null`; an empty string would fail URL validation.
  const instagram = instagramRaw ? instagramRaw : null;

  const raw = {
    id: providedId,
    name: strField("name"),
    city: strField("city"),
    citySlug: strField("citySlug") || undefined,
    address: strField("address"),
    types: strListField("type"),
    sports: strListField("sports"),
    // If we ingested a remote URL, `imageUrl` already holds the stored
    // placeholder URL (imagePath is set). Otherwise fall back to the raw
    // external URL verbatim – Zod will validate it or fail with 400.
    image: imageUrl || rawExternalUrl,
    imagePath: imagePath ?? undefined,
    country,
    countryCode: countryCode || undefined,
    location: {
      lat: numField("lat"),
      lon: numField("lon"),
    },
    instagram,
    createdBy: user.id,
  };

  const parsed = NewSpotSchema.safeParse(raw);
  if (!parsed.success) {
    if (imagePath) await deleteSpotImage(imagePath).catch(() => undefined);
    return NextResponse.json(
      { error: "Invalid spot", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Scoped curator check: fail-closed — every creation must be scope-checked.
  // Uses shared helper `resolveScopeCountryCode` (also used by events) so
  // empty/unknown country never bypasses `requireSpotCurationAccess`.
  {
    let scopeCountryCode: string
    try {
      const { resolveScopeCountryCode } = await import("@/lib/services/country-scope")
      scopeCountryCode = await resolveScopeCountryCode({
        countryCode: parsed.data.countryCode ?? countryCode,
        country: parsed.data.country,
      })
    } catch (err) {
      if (imagePath) await deleteSpotImage(imagePath).catch(() => undefined)
      if (err instanceof TimeoutError || isConnectionError(err)) {
        return NextResponse.json({ error: "The spots service is temporarily unavailable" }, { status: 503 })
      }
      const msg = err instanceof Error ? err.message : "countryCode is required"
      const status = (err as { status?: number }).status ?? 400
      return NextResponse.json({ error: msg }, { status })
    }
    try {
      const scoped = await requireSpotCurationAccess(scopeCountryCode, ["content.write", "media.manage"])
      user = scoped
    } catch (err) {
      if (imagePath) await deleteSpotImage(imagePath).catch(() => undefined)
      return authorizationErrorResponse(err)
    }
  }

  try {
    const spot = await createSpot(parsed.data);
    return setUpdatedAtHeaders(NextResponse.json(spot, { status: 201 }), spot.updatedAt);
  } catch (err) {
    if (imagePath) await deleteSpotImage(imagePath).catch(() => undefined);
    return mapMutationErrorResponse(err, {
      serviceName: "spots",
      notFoundPrefixes: [],
      logLabel: "api.admin.spots.create_failed",
      log: log.error,
    });
  }
}
