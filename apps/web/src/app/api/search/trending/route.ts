/**
 * GET /api/search/trending
 * Returns trending search queries based on browsing history over the last 7 days.
 * Public — no auth required. Cached 5 minutes.
 * Source: G10.6
 */

import { NextResponse } from 'next/server';
import { db } from '@twicely/db';
import { browsingHistory } from '@twicely/db/schema';
import { sql } from 'drizzle-orm';
import { logger } from '@twicely/logger';

const TRENDING_LIMIT = 8;
const WINDOW_DAYS = 7;

const FALLBACK_TRENDING = [
  'Nike sneakers',
  'Vintage denim',
  'Designer handbags',
  'Streetwear hoodies',
  'Air Jordan',
  'Lululemon leggings',
  'Supreme',
  'Levi\'s jeans',
];

export async function GET(): Promise<NextResponse> {
  try {
    const since = new Date();
    since.setDate(since.getDate() - WINDOW_DAYS);

    const rows = await db
      .select({
        query: browsingHistory.searchQuery,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(browsingHistory)
      .where(
        sql`${browsingHistory.searchQuery} IS NOT NULL AND ${browsingHistory.lastViewedAt} >= ${since}`,
      )
      .groupBy(browsingHistory.searchQuery)
      .orderBy(sql`count(*) DESC`)
      .limit(TRENDING_LIMIT);

    const trending = rows
      .map((r) => r.query)
      .filter((q): q is string => q !== null && q.trim().length > 0);

    // Pad with fallbacks if not enough real data; always cap at TRENDING_LIMIT
    const combined =
      trending.length >= 4
        ? trending
        : [...new Set([...trending, ...FALLBACK_TRENDING])];
    const result = combined.slice(0, TRENDING_LIMIT);

    return NextResponse.json(
      { trending: result },
      { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' } },
    );
  } catch (err) {
    logger.error('[search/trending] Error', { error: String(err) });
    return NextResponse.json(
      { trending: FALLBACK_TRENDING.slice(0, TRENDING_LIMIT) },
      { headers: { 'Cache-Control': 'public, max-age=60' } },
    );
  }
}
