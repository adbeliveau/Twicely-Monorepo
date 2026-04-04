import { NextResponse } from 'next/server';
import { db } from '@twicely/db';
import { crosslisterAccount } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '@twicely/logger';
import {
  authenticateExtensionRequest,
  ExtensionAuthError,
} from '@/lib/auth/extension-auth';

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { principal } = await authenticateExtensionRequest(request);
    const userId = principal.userId;

    const accounts = await db
      .select({ channel: crosslisterAccount.channel })
      .from(crosslisterAccount)
      .where(and(
        eq(crosslisterAccount.sellerId, userId),
        eq(crosslisterAccount.status, 'ACTIVE'),
      ));

    return NextResponse.json({
      success: true,
      serverTime: Date.now(),
      connectedChannels: accounts.map((a) => a.channel),
    });
  } catch (err) {
    if (err instanceof ExtensionAuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }

    logger.error('[extension/heartbeat] Failed to load heartbeat', { error: String(err) });
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
