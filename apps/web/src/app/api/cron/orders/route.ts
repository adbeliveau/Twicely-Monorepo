import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { autoCompleteDeliveredOrders } from '@twicely/commerce/shipping';
import { logger } from '@twicely/logger';

/**
 * Cron job: Auto-complete orders after configurable escrow hold period.
 * Should be called every hour by Railway Cron or similar scheduler.
 *
 * Protected by CRON_SECRET header.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    logger.error('[cron/orders] CRON_SECRET not configured');
    return NextResponse.json({ error: 'Not configured' }, { status: 500 });
  }

  const expected = Buffer.from(`Bearer ${expectedSecret}`);
  const actual = Buffer.from(authHeader ?? '');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const count = await autoCompleteDeliveredOrders();

    return NextResponse.json({ success: true, autoCompleted: count });
  } catch (error) {
    logger.error('[cron/orders] Error', { error });
    return NextResponse.json(
      { error: 'Failed to auto-complete orders' },
      { status: 500 }
    );
  }
}
