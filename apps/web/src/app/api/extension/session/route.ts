import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { db } from '@twicely/db';
import { crosslisterAccount } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { logger } from '@twicely/logger';
import { defineAbilitiesFor, sub } from '@twicely/casl';

const sessionSchema = z.object({
  channel: z.enum(['POSHMARK', 'FB_MARKETPLACE', 'THEREALREAL', 'VESTIAIRE'] as const),
  sessionData: z.record(z.string(), z.unknown()),
}).strict();

export async function POST(request: Request): Promise<NextResponse> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const rawSecret = process.env['EXTENSION_JWT_SECRET'];
  if (!rawSecret) {
    return NextResponse.json({ success: false, error: 'Extension authentication unavailable' }, { status: 503 });
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

  const parsed = sessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
  }

  const { channel, sessionData } = parsed.data;

  // CASL authorization check — user must have crosslister account creation/update rights
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

  try {
    const [existing] = await db
      .select({ id: crosslisterAccount.id })
      .from(crosslisterAccount)
      .where(and(
        eq(crosslisterAccount.sellerId, userId),
        eq(crosslisterAccount.channel, channel),
      ))
      .limit(1);

    if (existing) {
      await db.update(crosslisterAccount).set({
        sessionData,
        status: 'ACTIVE',
        lastAuthAt: new Date(),
        consecutiveErrors: 0,
        lastError: null,
        lastErrorAt: null,
        updatedAt: new Date(),
      }).where(eq(crosslisterAccount.id, existing.id));
    } else {
      await db.insert(crosslisterAccount).values({
        sellerId: userId,
        channel,
        authMethod: 'SESSION',
        status: 'ACTIVE',
        sessionData,
        capabilities: {},
        lastAuthAt: new Date(),
      });
    }

    logger.info('[extension/session] Session data updated', { userId, channel });
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('[extension/session] Failed to update session', { userId, channel, error: String(err) });
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
