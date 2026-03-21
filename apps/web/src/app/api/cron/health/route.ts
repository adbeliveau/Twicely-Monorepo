import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { runAllChecks } from '@/lib/monitoring/doctor-runner';
import { sendSlackAlert } from '@/lib/monitoring/slack-alert';
import { logger } from '@twicely/logger';

/**
 * Cron job: Run doctor checks every 60 seconds.
 * Protected by CRON_SECRET Bearer token.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    logger.error('[cron/health] CRON_SECRET not configured');
    return NextResponse.json({ error: 'Not configured' }, { status: 500 });
  }

  const expected = Buffer.from(`Bearer ${expectedSecret}`);
  const actual = Buffer.from(authHeader ?? '');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const summary = await runAllChecks();
    const failed = summary.checks.filter((c) => c.status !== 'HEALTHY');

    if (failed.length > 0) {
      await sendSlackAlert(summary);
    }

    return NextResponse.json({
      healthy: summary.overall === 'HEALTHY',
      checksRun: summary.checks.length,
      failed: failed.length,
      checks: summary.checks.map((c) => ({
        name: c.name,
        module: c.module,
        status: c.status,
        latencyMs: c.latencyMs,
        message: c.message,
      })),
    });
  } catch (error) {
    logger.error('[cron/health] Failed to run checks', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
