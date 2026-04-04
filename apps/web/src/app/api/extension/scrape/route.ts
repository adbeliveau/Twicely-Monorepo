import { NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@twicely/logger';
import { getValkeyClient } from '@twicely/db/cache';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import {
  authenticateExtensionRequest,
  ExtensionAuthError,
} from '@/lib/auth/extension-auth';

const scrapeSchema = z.object({
  channel: z.enum(['POSHMARK', 'FB_MARKETPLACE', 'THEREALREAL', 'VESTIAIRE'] as const),
  listing: z.object({
    externalId: z.string().min(1),
    title: z.string().min(1).max(500),
    priceCents: z.number().int().min(0),
    currency: z.string().length(3).toUpperCase().optional(),
    description: z.string().max(10000).default(''),
    condition: z.string().max(50).nullable(),
    brand: z.string().max(200).nullable(),
    category: z.string().max(200).nullable(),
    size: z.string().max(50).nullable(),
    imageUrls: z.array(z.string().url()).max(20),
    url: z.string().url(),
  }).strict(),
}).strict();

const DEFAULT_SCRAPE_TTL_SECONDS = 3600;

export async function POST(request: Request): Promise<NextResponse> {
  let userId: string;
  try {
    const { principal } = await authenticateExtensionRequest(request);
    userId = principal.userId;
  } catch (err) {
    if (err instanceof ExtensionAuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }

    throw err;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = scrapeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
  }

  const { channel, listing } = parsed.data;

  const scrapeTtl = await getPlatformSetting<number>(
    'extension.scrapeCacheTtlSeconds',
    DEFAULT_SCRAPE_TTL_SECONDS,
  );

  const cacheKey = `ext:scrape:${userId}:${channel}:${listing.externalId}`;
  try {
    const valkey = getValkeyClient();
    await valkey.set(
      cacheKey,
      JSON.stringify({ channel, listing, scrapedAt: Date.now() }),
      'EX',
      scrapeTtl,
    );
  } catch (err) {
    logger.warn('[extension/scrape] Failed to cache scrape data', {
      userId,
      channel,
      externalId: listing.externalId,
      error: String(err),
    });
  }

  logger.info('[extension/scrape] Listing scraped', {
    userId,
    channel,
    externalId: listing.externalId,
  });

  return NextResponse.json({ success: true });
}
