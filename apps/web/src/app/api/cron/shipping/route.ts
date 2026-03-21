import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { scanForShippingExceptions } from '@twicely/commerce/shipping-exceptions';
import { logger } from '@twicely/logger';

/**
 * Cron job: Scan for shipping exceptions (lost/delayed packages).
 * Should be called every hour by Railway Cron or similar scheduler.
 *
 * Protected by CRON_SECRET header.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    logger.error('[cron/shipping] CRON_SECRET not configured');
    return NextResponse.json({ error: 'Not configured' }, { status: 500 });
  }

  const expected = Buffer.from(`Bearer ${expectedSecret}`);
  const actual = Buffer.from(authHeader ?? '');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const exceptionsFound = await scanForShippingExceptions();

    return NextResponse.json({
      success: true,
      exceptionsFound,
    });
  } catch (error) {
    logger.error('[cron/shipping] Error', { error });
    return NextResponse.json(
      { error: 'Failed to scan for shipping exceptions' },
      { status: 500 }
    );
  }
}
