/**
 * Prometheus metrics endpoint.
 * GET /api/metrics
 *
 * Protected by METRICS_SECRET Bearer token (separate from CRON_SECRET).
 * Used by Prometheus scraping — not staff auth.
 * E5 — Monitoring
 */

import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { getMetricsText } from '@/lib/monitoring/metrics';
import { logger } from '@twicely/logger';

export async function GET(request: Request): Promise<NextResponse> {
  const metricsSecret = process.env.METRICS_SECRET;

  if (!metricsSecret) {
    logger.error('[metrics] METRICS_SECRET not configured');
    return NextResponse.json(
      { error: 'Metrics endpoint not configured' },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get('authorization');

  const expected = Buffer.from(`Bearer ${metricsSecret}`);
  const actual = Buffer.from(authHeader ?? '');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const text = await getMetricsText();

    return new NextResponse(text, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
      },
    });
  } catch (error) {
    logger.error('[metrics] Failed to serialize metrics', { error });
    return NextResponse.json(
      { error: 'Failed to collect metrics' },
      { status: 500 }
    );
  }
}
