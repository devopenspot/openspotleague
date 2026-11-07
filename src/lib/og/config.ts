export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = "image/png" as const;
export const OG_ALT_DEFAULT = "Open Spot — Discover and map skate spots";
export const OG_ALT_LEAGUE = "OpenSpot League";
/**
 * Static share cards, designed in design/og-cards/ and exported to public/og/
 * (see docs/og-cards.md). Change a card by shipping it under a new filename:
 * platforms cache share images by URL.
 */
export const OG_IMAGES = {
  default: "/og/og-default.png",
  tv: "/og/og-tv.png",
  league: "/og/og-league.png",
  gamesTraining: "/og/og-games-training.png",
  gamesBattle: "/og/og-games-battle.png",
  leagueResults: "/og/og-league-results.png",
  gamesResults: "/og/og-games-results.png",
  rider: "/og/og-rider.png",
  curator: "/og/og-data-curator.png",
} as const;

/** OpenGraph image entry for a static 1200x630 card. */
export function ogImage(url: string, alt: string) {
  return { url, width: OG_SIZE.width, height: OG_SIZE.height, alt };
}

export const DEFAULT_OG_IMAGE_PATH = OG_IMAGES.default;
export const CHALLENGE_OG_IMAGE_PATH = "/challenges.jpg";
export const TRAINING_OG_IMAGE_PATH = "/trainings.jpg";

/** WhatsApp / OpenGraph recommended cache */
export const OG_REVALIDATE_SECONDS = 3600;

/** Base share card for a game: results once complete, else by mode. */
export function gameOgCard(mode: string, status: string): string {
  if (status === "complete") return OG_IMAGES.gamesResults;
  return mode === "challenge" ? OG_IMAGES.gamesBattle : OG_IMAGES.gamesTraining;
}

/** Fallback share card for a contest without its own cover. */
export function contestOgCard(status: string): string {
  return status === "completed" ? OG_IMAGES.leagueResults : OG_IMAGES.league;
}
