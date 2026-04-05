/**
 * GET /api/search/suggestions?q=query
 * Returns typeahead suggestions: listing titles, brands, and category names.
 * Public — no auth required. Min 2 chars, max 100 chars.
 * Source: G10.6
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@twicely/db';
import { listing, category } from '@twicely/db/schema';
import { eq, ilike, sql, and } from 'drizzle-orm';
import { logger } from '@twicely/logger';
import { getClientIp } from '@/lib/utils/get-client-ip';

export interface SearchSuggestion {
  text: string;
  type: 'listing' | 'brand' | 'category';
}

const MAX_QUERY_LENGTH = 100;
const MIN_QUERY_LENGTH = 2;
const LISTING_LIMIT = 4;
const BRAND_LIMIT = 2;
const CATEGORY_LIMIT = 2;

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { getValkeyClient } = await import('@twicely/db/cache');
    const valkey = getValkeyClient();
    const ip = getClientIp(request.headers);
    const key = `search-rate:${ip}`;
    const count = await valkey.incr(key);
    if (count === 1) await valkey.expire(key, 60);
    if (count > 30) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }
  } catch { /* Valkey down — fail open */ }

  const q = request.nextUrl.searchParams.get('q') ?? '';
  const query = q.trim().slice(0, MAX_QUERY_LENGTH);

  if (query.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ suggestions: [] });
  }

  // Security: Escape LIKE wildcards to prevent wildcard injection
  const escaped = query.replace(/[%_\\]/g, '\\$&');
  const pattern = `%${escaped}%`;

  try {
    const [listingRows, brandRows, categoryRows] = await Promise.all([
      // Listing titles — distinct, active only
      db
        .selectDistinct({ text: listing.title })
        .from(listing)
        .where(and(eq(listing.status, 'ACTIVE'), ilike(listing.title, pattern)))
        .limit(LISTING_LIMIT),

      // Brands — distinct non-null values
      db
        .selectDistinct({ text: listing.brand })
        .from(listing)
        .where(and(eq(listing.status, 'ACTIVE'), ilike(listing.brand, pattern)))
        .limit(BRAND_LIMIT),

      // Category names
      db
        .select({ text: category.name })
        .from(category)
        .where(and(eq(category.isActive, true), ilike(category.name, pattern)))
        .orderBy(sql`${category.depth} ASC`)
        .limit(CATEGORY_LIMIT),
    ]);

    const seen = new Set<string>();
    const suggestions: SearchSuggestion[] = [];

    for (const row of listingRows) {
      if (row.text && !seen.has(row.text.toLowerCase())) {
        seen.add(row.text.toLowerCase());
        suggestions.push({ text: row.text, type: 'listing' });
      }
    }

    for (const row of brandRows) {
      if (row.text && !seen.has(row.text.toLowerCase())) {
        seen.add(row.text.toLowerCase());
        suggestions.push({ text: row.text, type: 'brand' });
      }
    }

    for (const row of categoryRows) {
      if (row.text && !seen.has(row.text.toLowerCase())) {
        seen.add(row.text.toLowerCase());
        suggestions.push({ text: row.text, type: 'category' });
      }
    }

    return NextResponse.json(
      { suggestions },
      { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } },
    );
  } catch (err) {
    logger.error('[search/suggestions] Error', { error: String(err) });
    return NextResponse.json({ suggestions: [] });
  }
}
