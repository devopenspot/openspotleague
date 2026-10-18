import { ImageResponse } from "next/og";
import { getGameOgPreviewById } from "@/lib/services/games";
import { withSafeDefault } from "@/lib/utils/safe-fetch";
import { OG_SIZE } from "@/lib/og/config";
import { loadPublicImageAsDataUrl } from "@/lib/og/images";

export const alt = "Game preview — Open Spot";
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
  const preview = await withSafeDefault(
    () => getGameOgPreviewById(id),
    null,
    "getGameOgPreviewById(og-image)",
  );

  const leagueDataUrl = loadPublicImageAsDataUrl("/opengrapgh.png");

  if (!preview) {
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
            width={200}
            height={200}
            style={{ objectFit: "contain" }}
          />
        ) : null}
        <div
          style={{ fontSize: 26, fontWeight: 800, textTransform: "uppercase" }}
        >
          Game unavailable
        </div>
      </div>,
      { ...size },
    );
  }

  const isChallenge = preview.mode === "challenge";
  const baseImagePath = isChallenge ? "/challenges.jpg" : "/trainings.jpg";
  const baseDataUrl = loadPublicImageAsDataUrl(baseImagePath) ?? leagueDataUrl;

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
      {baseDataUrl ? (
        <img
          src={baseDataUrl}
          alt={isChallenge ? "Challenge" : "Training"}
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
            fontSize: 18,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 2,
          }}
        >
          {isChallenge ? "Challenge" : "Training"}
        </div>
      )}
    </div>,
    { ...size },
  );
}
