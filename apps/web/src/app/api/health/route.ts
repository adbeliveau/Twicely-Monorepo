import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@twicely/db';
import { logger } from '@twicely/logger';

/**
 * Public liveness / readiness endpoint.
 *
 * Returns 200 when the web service is running and the DB is reachable.
 * Returns 503 when the DB ping fails.
 *
 * - No authentication required (intended for load balancers, uptime monitors,
 *   and k8s liveness probes)
 * - No sensitive data exposed
 * - Deep diagnostics live behind `/api/cron/health` + `/health/doctor` (hub)
 */
export async function GET() {
  const startedAt = Date.now();

  try {
    // Cheap liveness ping — forces a round-trip to Postgres
    await db.execute(sql`SELECT 1`);

    return NextResponse.json(
      {
        status: 'ok',
        service: 'web',
        timestamp: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error) {
    logger.error('[api/health] liveness check failed', {
      error: error instanceof Error ? error.message : 'Unknown',
    });

    return NextResponse.json(
      {
        status: 'error',
        service: 'web',
        timestamp: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  }
}
