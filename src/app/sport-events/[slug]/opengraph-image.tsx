import { ImageResponse } from "next/og";
import { findEventBySlug } from "@/lib/services/event/events";
import { withSafeDefault } from "@/lib/utils/safe-fetch";
import { OG_SIZE } from "@/lib/og/config";
import { loadPublicImageAsDataUrl } from "@/lib/og/images";

export const alt = "Sport event — Open Spot";
export const size = OG_SIZE;
export const contentType = "image/png";
export const runtime = "nodejs";
export const revalidate = 3600;

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await withSafeDefault(
    () => findEventBySlug(slug),
    null,
    "findEventBySlug(og-image)",
  );
  const leagueDataUrl = await loadPublicImageAsDataUrl("/opengraph.png");

  if (!event) {
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
          gap: 14,
        }}
      >
        {leagueDataUrl ? (
          <img
            src={leagueDataUrl}
            alt=""
            width={220}
            height={220}
            style={{ objectFit: "contain" }}
          />
        ) : null}
        <div
          style={{
            fontSize: 28,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: 1,
          }}
        >
          Event unavailable
        </div>
      </div>,
      { ...size },
    );
  }

  const eventImageSrc =
    event.image && /^https?:\/\//.test(event.image)
      ? event.image
      : leagueDataUrl;

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
      {eventImageSrc ? (
        <img
          src={eventImageSrc}
          alt={event.name}
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
