/**
 * Sitemap Generation — Canonical 21 §8
 *
 * Dynamic sitemap generation with sitemap index pattern.
 * Listing sitemaps are chunked at configurable page size.
 */

import { db } from '@twicely/db';
import { listing, category, storefront } from '@twicely/db/schema';
import { eq, or, and, gte, desc } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type SitemapUrl = {
  loc: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
};

export type SitemapIndexEntry = {
  loc: string;
  lastmod?: string;
};

// ─── Constants ─────────────────────────────────────────────────────────────────

const BASE_URL = 'https://twicely.co';

// ─── XML Builders ──────────────────────────────────────────────────────────────

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Build a standard XML sitemap from a list of URLs. */
export function buildSitemapXml(urls: SitemapUrl[]): string {
  const entries = urls.map((u) => {
    let entry = `  <url>\n    <loc>${escapeXml(u.loc)}</loc>`;
    if (u.lastmod) entry += `\n    <lastmod>${u.lastmod}</lastmod>`;
    if (u.changefreq) entry += `\n    <changefreq>${u.changefreq}</changefreq>`;
    if (u.priority !== undefined) entry += `\n    <priority>${u.priority.toFixed(1)}</priority>`;
    entry += '\n  </url>';
    return entry;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>`;
}

/** Build a sitemap index from a list of sub-sitemap entries. */
export function buildSitemapIndexXml(sitemaps: SitemapIndexEntry[]): string {
  const entries = sitemaps.map((s) => {
    let entry = `  <sitemap>\n    <loc>${escapeXml(s.loc)}</loc>`;
    if (s.lastmod) entry += `\n    <lastmod>${s.lastmod}</lastmod>`;
    entry += '\n  </sitemap>';
    return entry;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</sitemapindex>`;
}

// ─── Sitemap Generators ────────────────────────────────────────────────────────

/** Generate the sitemap index pointing to all sub-sitemaps. */
export async function generateSitemapIndex(): Promise<string> {
  const listingsPerFile = await getPlatformSetting<number>('seo.sitemap.listingsPerFile', 10000);
  const indexDays = await getPlatformSetting<number>('seo.soldListingIndexDays', 90);

  // Count total eligible listings
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(listing)
    .where(or(
      eq(listing.status, 'ACTIVE'),
      and(
        eq(listing.status, 'SOLD'),
        gte(listing.soldAt, sql`NOW() - make_interval(days => ${indexDays})`),
      ),
    ));

  const totalListings = countResult?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalListings / listingsPerFile));
  const now = new Date().toISOString().split('T')[0];

  const sitemaps: SitemapIndexEntry[] = [
    { loc: `${BASE_URL}/sitemap-static.xml`, lastmod: now },
    { loc: `${BASE_URL}/sitemap-categories.xml`, lastmod: now },
  ];

  for (let i = 1; i <= totalPages; i++) {
    sitemaps.push({ loc: `${BASE_URL}/sitemap-listings-${i}.xml`, lastmod: now });
  }

  sitemaps.push({ loc: `${BASE_URL}/sitemap-stores.xml`, lastmod: now });

  return buildSitemapIndexXml(sitemaps);
}

/** Generate sitemap for static pages. */
export async function generateStaticSitemap(): Promise<string> {
  const urls: SitemapUrl[] = [
    { loc: BASE_URL, changefreq: 'daily', priority: 1.0 },
    { loc: `${BASE_URL}/c`, changefreq: 'daily', priority: 0.9 },
    { loc: `${BASE_URL}/s`, changefreq: 'daily', priority: 0.7 },
    { loc: `${BASE_URL}/explore`, changefreq: 'daily', priority: 0.7 },
    { loc: `${BASE_URL}/p/terms`, changefreq: 'monthly', priority: 0.3 },
    { loc: `${BASE_URL}/p/privacy`, changefreq: 'monthly', priority: 0.3 },
    { loc: `${BASE_URL}/p/fees`, changefreq: 'monthly', priority: 0.3 },
    { loc: `${BASE_URL}/p/how-it-works`, changefreq: 'monthly', priority: 0.4 },
    { loc: `${BASE_URL}/p/buyer-protection`, changefreq: 'monthly', priority: 0.4 },
    { loc: `${BASE_URL}/h`, changefreq: 'weekly', priority: 0.4 },
    { loc: `${BASE_URL}/about`, changefreq: 'monthly', priority: 0.3 },
  ];

  return buildSitemapXml(urls);
}

/** Generate sitemap for all active categories. */
export async function generateCategorySitemap(): Promise<string> {
  const categories = await db
    .select({
      slug: category.slug,
      updatedAt: category.updatedAt,
      parentId: category.parentId,
      depth: category.depth,
    })
    .from(category)
    .where(eq(category.isActive, true));

  const urls: SitemapUrl[] = categories.map((cat) => ({
    loc: `${BASE_URL}/c/${cat.slug}`,
    lastmod: cat.updatedAt.toISOString().split('T')[0],
    changefreq: cat.depth === 0 ? 'daily' as const : 'weekly' as const,
    priority: cat.depth === 0 ? 0.9 : 0.7,
  }));

  return buildSitemapXml(urls);
}

/** Generate sitemap for listings (paginated). */
export async function generateListingSitemap(page: number): Promise<string> {
  const listingsPerFile = await getPlatformSetting<number>('seo.sitemap.listingsPerFile', 10000);
  const indexDays = await getPlatformSetting<number>('seo.soldListingIndexDays', 90);

  const listings = await db
    .select({
      slug: listing.slug,
      updatedAt: listing.updatedAt,
      status: listing.status,
    })
    .from(listing)
    .where(or(
      eq(listing.status, 'ACTIVE'),
      and(
        eq(listing.status, 'SOLD'),
        gte(listing.soldAt, sql`NOW() - make_interval(days => ${indexDays})`),
      ),
    ))
    .orderBy(desc(listing.updatedAt))
    .limit(listingsPerFile)
    .offset((page - 1) * listingsPerFile);

  const urls: SitemapUrl[] = listings
    .filter((l): l is typeof l & { slug: string } => l.slug !== null)
    .map((l) => ({
      loc: `${BASE_URL}/i/${l.slug}`,
      lastmod: l.updatedAt.toISOString().split('T')[0],
      changefreq: l.status === 'ACTIVE' ? 'daily' as const : 'monthly' as const,
      priority: l.status === 'ACTIVE' ? 0.6 : 0.3,
    }));

  return buildSitemapXml(urls);
}

/** Generate sitemap for active seller storefronts. */
export async function generateStoreSitemap(): Promise<string> {
  const stores = await db
    .select({
      slug: storefront.slug,
      updatedAt: storefront.updatedAt,
    })
    .from(storefront)
    .where(eq(storefront.isPublished, true));

  const urls: SitemapUrl[] = stores
    .filter((s): s is typeof s & { slug: string } => s.slug !== null)
    .map((s) => ({
      loc: `${BASE_URL}/st/${s.slug}`,
      lastmod: s.updatedAt.toISOString().split('T')[0],
      changefreq: 'weekly' as const,
      priority: 0.5,
    }));

  return buildSitemapXml(urls);
}
