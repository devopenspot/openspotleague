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

export function cspValue(nonce?: string): string {
  const scriptSrc = nonce ? `'self' 'nonce-${nonce}'` : `'self' 'unsafe-inline' 'unsafe-eval'`
  return [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    `style-src 'self' 'unsafe-inline'`,
    `connect-src 'self' https://*.supabase.co https://api.openweathermap.org https://nominatim.openstreetmap.org https://*.pooler.supabase.com`,
    `img-src 'self' data: blob: https://lh3.googleusercontent.com https://spots.cdn.openspotleague.com https://events.cdn.openspotleague.com`,
    `font-src 'self' data:`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
    `base-uri 'self'`,
  ].join("; ")
}
