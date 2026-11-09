import type { MetadataRoute } from 'next';
import { env } from '@/lib/config/env';

export const dynamic = 'force-static';

const BASE_URL = env.APP_URL;

// Every crawled URL runs the Worker and counts against the plan's daily
// request quota, so crawlers only get the public pages. Private, per-user,
// auth and API paths are never useful in an index. /admin/* is the operator
// dashboard (auth-gated, `robots: { index: false }`): skipping it also stops
// crawlers from following the `requireAdminOrRedirect` redirect.
const DISALLOWED_PATHS = [
  '/admin/',
  '/api/',
  '/auth/',
  '/account',
  '/login',
  '/notifications',
  '/profile',
  '/saved',
  '/s/',
  '/spots/new',
  // Query variants (filters, map positions, shuffles) multiply the URL space
  // without adding content.
  '/*?*',
];

// AI-training and SEO crawlers bring no visitors but crawl every spot page.
// Compliant ones honor this; the rest are blocked at the Cloudflare edge.
const BLOCKED_AGENTS = [
  'GPTBot',
  'CCBot',
  'ClaudeBot',
  'anthropic-ai',
  'Google-Extended',
  'Bytespider',
  'Amazonbot',
  'meta-externalagent',
  'FacebookBot',
  'PerplexityBot',
  'AhrefsBot',
  'SemrushBot',
  'MJ12bot',
  'DotBot',
  'PetalBot',
  'BLEXBot',
  'DataForSeoBot',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: BLOCKED_AGENTS, disallow: '/' },
      { userAgent: '*', allow: '/', disallow: DISALLOWED_PATHS },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
