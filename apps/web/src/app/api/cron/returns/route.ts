import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { autoApproveOverdueReturns } from '@twicely/commerce/returns';
import { logger } from '@twicely/logger';

/**
 * Cron job: Auto-approve returns where seller didn't respond in 3 business days.
 * Should be called every hour by Railway Cron or similar scheduler.
 *
 * Protected by CRON_SECRET header.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    logger.error('[cron/returns] CRON_SECRET not configured');
    return NextResponse.json({ error: 'Not configured' }, { status: 500 });
  }

  const expected = Buffer.from(`Bearer ${expectedSecret}`);
  const actual = Buffer.from(authHeader ?? '');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const count = await autoApproveOverdueReturns();

    return NextResponse.json({ success: true, autoApproved: count });
  } catch (error) {
    logger.error('[cron/returns] Error', { error });
    return NextResponse.json(
      { error: 'Failed to process overdue returns' },
      { status: 500 }
    );
  }
}
