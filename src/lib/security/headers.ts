export const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
  { key: "X-XSS-Protection", value: "0" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-site" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
] as const

/**
 * Develop is for the team only (docs/environments.md): search engines stay
 * out. next.config.mjs adds the same header to static responses.
 */
export const NOINDEX_HEADER = { key: "X-Robots-Tag", value: "noindex, nofollow" } as const

export function isIndexableEnvironment(appEnv: string | undefined): boolean {
  return appEnv !== "develop"
}

export function cspValue(nonce?: string): string {
  const scriptSrc = nonce
    ? `'self' 'nonce-${nonce}' https://static.cloudflareinsights.com`
    : `'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com`
  return [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    `style-src 'self' 'unsafe-inline'`,
    `connect-src 'self' https://*.supabase.co https://api.openweathermap.org https://nominatim.openstreetmap.org https://*.pooler.supabase.com https://cloudflareinsights.com`,
    `img-src 'self' data: blob: https://*.tile.openstreetmap.org https://lh3.googleusercontent.com https://i.ytimg.com https://*.cdn.openspotleague.com`,
    `font-src 'self' data:`,
    `frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
    `base-uri 'self'`,
  ].join("; ")
}
