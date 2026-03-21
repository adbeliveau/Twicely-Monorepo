import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { db } from '@twicely/db';
import { crosslisterAccount } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '@twicely/logger';

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

  try {
    const { payload } = await jwtVerify(token, secret);
    if (payload['purpose'] !== 'extension-session') {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 403 });
    }

    const userId = payload['userId'];
    if (typeof userId !== 'string' || !userId) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 403 });
    }

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
    logger.warn('[extension/heartbeat] Invalid token', { error: String(err) });
    return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
  }
}
