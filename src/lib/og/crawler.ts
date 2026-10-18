const BOT_RE = /WhatsApp|facebookexternalhit|Twitterbot|Slackbot|TelegramBot|LinkedInBot|Discordbot|Facebot|facebookcatalog/i;

export function isSocialCrawler(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return BOT_RE.test(userAgent);
}
