import type { Metadata } from "next";
import { OG_IMAGES, ogImage } from "@/lib/og/config";

export const metadata: Metadata = {
  title: "Training & battles",
  description:
    "Train anywhere or battle riders at a spot with Open Spot. Share a lobby and ride together.",
  openGraph: {
    type: "website",
    title: "Open Spot training & battles",
    description:
      "Train anywhere or battle riders at a spot with Open Spot. Share a lobby and ride together.",
    images: [ogImage(OG_IMAGES.gamesTraining, "Open Spot training and battles")],
  },
  twitter: {
    card: "summary_large_image",
    title: "Open Spot training & battles",
    description:
      "Train anywhere or battle riders at a spot with Open Spot. Share a lobby and ride together.",
    images: [OG_IMAGES.gamesTraining],
  },
};

export default function GamesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
