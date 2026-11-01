/** @type {import('next').NextConfig} */
const nextConfig = {
  cacheComponents: true,
  images: {
    // R2 CDN: variants 128/400/800 WebP generated via sharp at upload.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
      },
      {
        protocol: 'https',
        hostname: 'spots.cdn.openspotleague.com',
      },
      {
        protocol: 'https',
        hostname: 'events.cdn.openspotleague.com',
      },
    ],
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'motion', 'leaflet', 'zustand'],
  },
  async headers() {
    // Mirrors src/lib/security/headers.ts — keep inline for build-time (TS not resolvable here)
    const baseHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
      { key: "X-XSS-Protection", value: "0" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      { key: "Cross-Origin-Resource-Policy", value: "same-site" },
      { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
    ]
    const cspReportOnly = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.supabase.co https://api.openweathermap.org https://nominatim.openstreetmap.org https://*.pooler.supabase.com https://cloudflareinsights.com; img-src 'self' data: blob: https://*.tile.openstreetmap.org https://lh3.googleusercontent.com https://i.ytimg.com https://spots.cdn.openspotleague.com https://events.cdn.openspotleague.com; font-src 'self' data:; frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com; frame-ancestors 'none'; form-action 'self'; base-uri 'self'"
    const securityHeaders = [...baseHeaders, { key: "Content-Security-Policy-Report-Only", value: cspReportOnly }]
    const tvHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
      { key: "X-XSS-Protection", value: "0" },
      { key: "Content-Security-Policy", value: "frame-ancestors *" },
    ];
    // HSTS is set via proxy in production; also declare here for static responses
    if (process.env.NODE_ENV === "production") {
      const hsts = {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      };
      securityHeaders.push(hsts);
      tvHeaders.push(hsts);
    }
    return [
      {
        source: "/tv",
        headers: tvHeaders,
      },
      {
        source: "/tv/:path*",
        headers: tvHeaders,
      },
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
