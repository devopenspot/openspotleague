import { ImageResponse } from "next/og";
import { OG_SIZE } from "@/lib/og/config";
import { loadPublicImageAsDataUrl } from "@/lib/og/images";

export const alt = "OpenSpot League — Discover and map skate spots";
export const size = OG_SIZE;
export const contentType = "image/png";
export const runtime = "nodejs";
export const dynamic = "force-static";

export default async function Image() {
  const leagueDataUrl = await loadPublicImageAsDataUrl("/opengraph.png");

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#ffffff",
        overflow: "hidden",
      }}
    >
      {leagueDataUrl ? (
        <img
          src={leagueDataUrl}
          alt="OpenSpot League"
          width={1200}
          height={630}
          style={{ objectFit: "contain", width: 1200, height: 630 }}
        />
      ) : (
        <div
          style={{
            display: "flex",
            width: 1200,
            height: 630,
            backgroundColor: "#0a0a0a",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
            fontFamily: "sans-serif",
            fontSize: 48,
            fontWeight: 800,
            letterSpacing: 4,
            textTransform: "uppercase",
          }}
        >
          OpenSpot League
        </div>
      )}
    </div>,
    { ...size },
  );
}
