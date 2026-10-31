import { ImageResponse } from "next/og";
import { loadPublicImageAsDataUrl } from "@/lib/og/images";
import {
  BRAND_BACKGROUND_COLOR,
  BRAND_FOREGROUND_COLOR,
} from "@/lib/config/brand";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";
export const runtime = "nodejs";
export const dynamic = "force-static";

export default async function Icon() {
  const faviconDataUrl = await loadPublicImageAsDataUrl("/favicon.png");

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: BRAND_BACKGROUND_COLOR,
        color: BRAND_FOREGROUND_COLOR,
      }}
    >
      {faviconDataUrl ? (
        <img
          src={faviconDataUrl}
          alt=""
          width={32}
          height={32}
          style={{ objectFit: "contain", width: 32, height: 32 }}
        />
      ) : null}
    </div>,
    { ...size },
  );
}
