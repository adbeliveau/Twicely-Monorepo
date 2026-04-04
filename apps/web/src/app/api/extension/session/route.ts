import { NextResponse } from 'next/server';
import { db } from '@twicely/db';
import { crosslisterAccount } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { logger } from '@twicely/logger';
import { encryptSessionData } from '@twicely/crosslister/token-crypto';
import {
  authenticateExtensionRequest,
  ExtensionAuthError,
} from '@/lib/auth/extension-auth';

const sessionSchema = z.object({
  channel: z.enum(['POSHMARK', 'FB_MARKETPLACE', 'THEREALREAL', 'VESTIAIRE'] as const),
  sessionData: z.record(z.string(), z.unknown()),
}).strict();

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

  const parsed = sessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
  }

  const { channel, sessionData: rawSessionData } = parsed.data;
  const sessionData = encryptSessionData(rawSessionData);

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
