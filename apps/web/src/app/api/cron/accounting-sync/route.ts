import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { db } from '@twicely/db';
import { accountingIntegration } from '@twicely/db/schema';
import { eq, and, not, isNull } from 'drizzle-orm';
import { logger } from '@twicely/logger';
import { runFullSync } from '@/lib/accounting/sync-engine';

/**
 * Cron job: Run accounting sync for all non-manual integrations.
 * Protected by CRON_SECRET header.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    logger.error('[cron/accounting-sync] CRON_SECRET not configured');
    return NextResponse.json({ error: 'Not configured' }, { status: 500 });
  }

  const expected = Buffer.from(`Bearer ${expectedSecret}`);
  const actual = Buffer.from(authHeader ?? '');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Find all active integrations that are NOT manual sync
    const integrations = await db
      .select({ id: accountingIntegration.id })
      .from(accountingIntegration)
      .where(
        and(
          eq(accountingIntegration.status, 'CONNECTED'),
          not(eq(accountingIntegration.syncFrequency, 'MANUAL')),
          not(isNull(accountingIntegration.accessToken)),
        ),
      );

    let synced = 0;
    let failed = 0;

    for (const integration of integrations) {
      try {
        await runFullSync(integration.id);
        synced++;
      } catch (err) {
        failed++;
        logger.error('[cron/accounting-sync] Sync failed for integration', {
          integrationId: integration.id,
          error: String(err),
        });
      }
    }

    return NextResponse.json({ success: true, synced, failed, total: integrations.length });
  } catch (error) {
    logger.error('[cron/accounting-sync] Error', { error });
    return NextResponse.json(
      { error: 'Failed to run accounting sync' },
      { status: 500 },
    );
  }
}
