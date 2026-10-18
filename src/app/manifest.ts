import type { MetadataRoute } from "next";
import { BRAND_BACKGROUND_COLOR } from "@/lib/config/brand";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Open Spot",
    short_name: "Open Spot",
    description:
      "Open Spot League is a directory and activity board for riders to maintain a consistent training routine and discover new spots to ride.",
    start_url: "/",
    display: "standalone",
    background_color: BRAND_BACKGROUND_COLOR,
    theme_color: "#000000",
    icons: [
      { src: "/icon", sizes: "32x32", type: "image/png", purpose: "any" },
    ],
  };
}
