import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { z } from 'zod';
import { logger } from '@twicely/logger';
import { getValkeyClient } from '@twicely/db/cache';
import { defineAbilitiesFor, sub } from '@twicely/casl';
import { getPlatformSetting } from '@/lib/queries/platform-settings';

// Zod schema for the scrape endpoint
const scrapeSchema = z.object({
  channel: z.enum(['POSHMARK', 'FB_MARKETPLACE', 'THEREALREAL', 'VESTIAIRE'] as const),
  listing: z.object({
    externalId: z.string().min(1),
    title: z.string().min(1).max(500),
    priceCents: z.number().int().min(0),
    currency: z.string().length(3).toUpperCase().optional(),  // ISO 4217 code
    description: z.string().max(10000).default(''),
    condition: z.string().max(50).nullable(),
    brand: z.string().max(200).nullable(),
    category: z.string().max(200).nullable(),
    size: z.string().max(50).nullable(),
    imageUrls: z.array(z.string().url()).max(20),
    url: z.string().url(),
  }).strict(),
}).strict();

// Default 1-hour TTL for cached scrape data (in seconds) — reads from platform_settings
const DEFAULT_SCRAPE_TTL_SECONDS = 3600;

export async function POST(request: Request): Promise<NextResponse> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const rawSecret = process.env['EXTENSION_JWT_SECRET'];
  if (!rawSecret) {
    return NextResponse.json(
      { success: false, error: 'Extension authentication unavailable' },
      { status: 503 },
    );
  }

  const token = authHeader.slice(7);
  const secret = new TextEncoder().encode(rawSecret);

  let userId: string;
  try {
    const { payload } = await jwtVerify(token, secret);
    if (payload['purpose'] !== 'extension-session') {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 403 });
    }
    const rawUserId = payload['userId'];
    if (typeof rawUserId !== 'string' || !rawUserId) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 403 });
    }
    userId = rawUserId;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
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

  // CASL authorization check
  const ability = defineAbilitiesFor({
    userId,
    email: '',
    isSeller: true,
    sellerId: userId,
    sellerStatus: null,
    delegationId: null,
    onBehalfOfSellerId: null,
    onBehalfOfSellerProfileId: null,
    delegatedScopes: [],
    isPlatformStaff: false,
    platformRoles: [],
  });
  if (!ability.can('create', sub('CrosslisterAccount', { sellerId: userId }))) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  // Read TTL from platform_settings (W-H04 fix)
  const scrapeTtl = await getPlatformSetting<number>(
    'extension.scrapeCacheTtlSeconds',
    DEFAULT_SCRAPE_TTL_SECONDS,
  );

  // Cache the scraped listing in Valkey.
  // Key pattern: ext:scrape:{userId}:{channel}:{externalId}
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
    // Cache failure is non-fatal — log and continue
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
