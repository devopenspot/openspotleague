import { ImageResponse } from "next/og";
import { findSpotById } from "@/lib/services/spot/spots";
import { withSafeDefault } from "@/lib/utils/safe-fetch";
import { DEFAULT_OG_IMAGE_PATH, OG_SIZE } from "@/lib/og/config";
import {
  fetchRemoteImageAsDataUrl,
  isHttpImageUrl,
  loadPublicImageAsDataUrl,
} from "@/lib/og/images";

export const alt = "Spot preview — Open Spot";
export const size = OG_SIZE;
export const contentType = "image/png";
export const runtime = "nodejs";
export const revalidate = 3600;

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const spot = await withSafeDefault(
    () => findSpotById(id),
    null,
    "findSpotById(og-image)",
  );
  const leagueDataUrl = await loadPublicImageAsDataUrl(DEFAULT_OG_IMAGE_PATH);

  // Server-side fetch so `next/og` (satori) never depends on the
  // renderer fetching a remote R2/Supabase URL itself: slow, redirecting,
  // or expired-signed originals fall back to the default asset instead of
  // producing a broken/blank OG PNG for WhatsApp.
  let spotImageSrc: string | null = leagueDataUrl;
  if (spot && isHttpImageUrl(spot.image)) {
    spotImageSrc =
      (await withSafeDefault(
        () => fetchRemoteImageAsDataUrl(spot.image),
        null,
        "fetchRemoteImageAsDataUrl(og-image)",
      )) ?? leagueDataUrl;
  }

  if (!spot) {
    return new ImageResponse(
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0a0a0a",
          color: "#fff",
          fontFamily: "sans-serif",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {leagueDataUrl ? (
          <img
            src={leagueDataUrl}
            alt="OpenSpot League"
            width={220}
            height={220}
            style={{ objectFit: "contain" }}
          />
        ) : null}
        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 1,
          }}
        >
          Spot unavailable
        </div>
      </div>,
      { ...size },
    );
  }

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        backgroundColor: "#0a0a0a",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {spotImageSrc ? (
        <img
          src={spotImageSrc}
          alt={spot.name}
          width={1200}
          height={630}
          style={{ objectFit: "cover", width: 1200, height: 630 }}
        />
      ) : (
        <div
          style={{
            display: "flex",
            width: 1200,
            height: 630,
            backgroundColor: "#1a1a1a",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: 14,
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          OpenSpot
        </div>
      )}
    </div>,
    { ...size },
  );
}
