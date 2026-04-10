/**
 * robots.txt Generator — Canonical 21 §9
 *
 * Generates robots.txt content blocking private/admin routes
 * and including the sitemap directive.
 */

/** Generate robots.txt content. */
export function generateRobotsTxt(baseUrl: string, crawlDelay: number): string {
  return `User-agent: *
Allow: /
Disallow: /api/
Disallow: /my/
Disallow: /auth/
Disallow: /checkout/
Disallow: /cart/

# Hub routes (admin, staff-only)
Disallow: /d/
Disallow: /usr/
Disallow: /tx/
Disallow: /fin/
Disallow: /mod/
Disallow: /hd/
Disallow: /cfg/
Disallow: /roles/
Disallow: /audit/
Disallow: /health/
Disallow: /flags/
Disallow: /analytics/

Sitemap: ${baseUrl}/sitemap.xml

Crawl-delay: ${crawlDelay}
`;
}
