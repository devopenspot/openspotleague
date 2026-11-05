import { ImageResponse } from "next/og";
import { getSessionUser } from "@/lib/auth/server";
import { OG_SIZE } from "@/lib/og/config";
import { loadPublicImageAsDataUrl } from "@/lib/og/images";
import { getRiderResultCard } from "@/lib/services/league/result-card";
import { withSafeDefault } from "@/lib/utils/safe-fetch";

export const alt = "Contest result — Open Spot League";
export const size = OG_SIZE;
export const contentType = "image/png";
export const runtime = "nodejs";

/**
 * Rider result card. Public contests render for anyone (link previews);
 * unlisted contests only for a signed-in member, who can download it.
 */
export default async function Image({
  params,
}: {
  params: Promise<{ slug: string; userId: string }>;
}) {
  const { slug, userId } = await params;
  const viewer = await getSessionUser().catch(() => null);
  const card = await withSafeDefault(
    () => getRiderResultCard(slug, userId, viewer?.id ?? null),
    null,
    "getRiderResultCard(og)",
  );
  const fallback = await loadPublicImageAsDataUrl("/opengraph.png");
  const cover = card && /^https?:\/\//.test(card.contest.image) ? card.contest.image : fallback;
  const best = card ? [...card.results].sort((a, b) => a.rank - b.rank)[0] : null;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        backgroundColor: "#0a0a0a",
        color: "#fff",
        fontFamily: "sans-serif",
      }}
    >
      {cover ? (
        <img src={cover} alt="" width={1200} height={630} style={{ position: "absolute", inset: 0, objectFit: "cover", width: 1200, height: 630, opacity: 0.45 }} />
      ) : null}
      <div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 64, width: "100%", gap: 12 }}>
        <div style={{ fontSize: 26, textTransform: "uppercase", letterSpacing: 2, opacity: 0.85 }}>
          {card ? `${card.contest.name} · ${card.contest.dateRangeLabel}` : "Open Spot League"}
        </div>
        <div style={{ fontSize: 84, fontWeight: 800, textTransform: "uppercase", lineHeight: 1 }}>
          {card ? card.rider.name : "Result unavailable"}
        </div>
        {card && best ? (
          <div style={{ display: "flex", gap: 24, marginTop: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", padding: "16px 24px", borderRadius: 16, backgroundColor: "rgba(255,255,255,0.12)" }}>
              <div style={{ fontSize: 22, textTransform: "uppercase", opacity: 0.8 }}>{best.label}</div>
              <div style={{ fontSize: 64, fontWeight: 800 }}>#{best.rank}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", padding: "16px 24px", borderRadius: 16, backgroundColor: "rgba(255,255,255,0.12)" }}>
              <div style={{ fontSize: 22, textTransform: "uppercase", opacity: 0.8 }}>Score</div>
              <div style={{ fontSize: 64, fontWeight: 800 }}>{best.score.toFixed(2)}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", padding: "16px 24px", borderRadius: 16, backgroundColor: "rgba(255,255,255,0.12)" }}>
              <div style={{ fontSize: 22, textTransform: "uppercase", opacity: 0.8 }}>League pts</div>
              <div style={{ fontSize: 64, fontWeight: 800 }}>+{best.pointsAwarded}</div>
            </div>
          </div>
        ) : null}
      </div>
    </div>,
    { ...size },
  );
}
