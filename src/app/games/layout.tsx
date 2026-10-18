import type { Metadata } from "next";
import { GameShell } from "@/components/games/layout/GameShell";

export const metadata: Metadata = {
  title: "Training & challenges",
  description:
    "Train and challenge riders with Open Spot. Share a lobby and ride together.",
  openGraph: {
    type: "website",
    title: "Open Spot training & challenges",
    description:
      "Train and challenge riders with Open Spot. Share a lobby and ride together.",
    images: [
      {
        url: "/challenges.jpg",
        alt: "Open Spot training and challenges",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Open Spot training & challenges",
    description:
      "Train and challenge riders with Open Spot. Share a lobby and ride together.",
    images: ["/challenges.jpg"],
  },
};

export default function GamesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <GameShell>{children}</GameShell>;
}
