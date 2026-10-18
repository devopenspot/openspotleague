import type { MetadataRoute } from 'next';
import { env } from '@/lib/config/env';

export const dynamic = 'force-static';

const BASE_URL = env.APP_URL;

export default function robots(): MetadataRoute.Robots {
  return {
    // /admin/* is the operator dashboard. Auth-gated and carries
    // `robots: { index: false, follow: false }` metadata, and we still
    // tell crawlers to skip it so search engines never follow the
    // `requireAdminOrRedirect` redirect or spend a budget on it.
    rules: { userAgent: '*', allow: '/', disallow: '/admin/' },
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
