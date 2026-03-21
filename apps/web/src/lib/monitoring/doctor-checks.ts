/**
 * Doctor Check Definitions — per-service health probe functions.
 * Each check has a 5s timeout and returns HealthCheckResult.
 */

import { db } from '@twicely/db';
import { platformSetting } from '@twicely/db/schema';
import { sql, count } from 'drizzle-orm';
import { getValkeyClient } from '@twicely/db/cache';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import type { HealthCheckResult } from './types';

const TIMEOUT_MS = 5000;

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), ms)
    ),
  ]);
}

function makeResult(
  name: string, module: string, status: HealthCheckResult['status'],
  latencyMs: number, message: string | null,
): HealthCheckResult {
  return { name, module, status, latencyMs, message, checkedAt: new Date() };
}

async function checkDbConnection(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    await withTimeout(db.execute(sql`SELECT 1`), TIMEOUT_MS);
    return makeResult('db.connection', 'Database', 'HEALTHY', Date.now() - start, null);
  } catch (error) {
    return makeResult('db.connection', 'Database', 'UNHEALTHY', Date.now() - start,
      error instanceof Error ? error.message : 'Unknown error');
  }
}

async function checkDbPool(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    await withTimeout(db.execute(sql`SELECT 1`), TIMEOUT_MS);
    return makeResult('db.pool', 'Database', 'HEALTHY', Date.now() - start, null);
  } catch (error) {
    return makeResult('db.pool', 'Database', 'UNHEALTHY', Date.now() - start,
      error instanceof Error ? error.message : 'Unknown error');
  }
}

async function checkAppEnv(): Promise<HealthCheckResult> {
  const start = Date.now();
  const required = ['DATABASE_URL', 'CRON_SECRET'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    return makeResult('app.env', 'App', 'UNHEALTHY', Date.now() - start,
      `Missing env vars: ${missing.join(', ')}`);
  }
  return makeResult('app.env', 'App', 'HEALTHY', Date.now() - start, null);
}

async function checkAppSettings(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const [result] = await withTimeout(
      db.select({ total: count() }).from(platformSetting),
      TIMEOUT_MS,
    );
    const total = result?.total ?? 0;
    if (total === 0) {
      return makeResult('app.settings', 'App', 'UNHEALTHY', Date.now() - start,
        'No platform settings found');
    }
    return makeResult('app.settings', 'App', 'HEALTHY', Date.now() - start,
      `${total} settings`);
  } catch (error) {
    return makeResult('app.settings', 'App', 'UNHEALTHY', Date.now() - start,
      error instanceof Error ? error.message : 'Unknown error');
  }
}

async function checkValkeyPing(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const client = getValkeyClient();
    const pong = await withTimeout(client.ping(), TIMEOUT_MS);
    if (pong === 'PONG') {
      return makeResult('valkey.ping', 'Valkey', 'HEALTHY', Date.now() - start, null);
    }
    return makeResult('valkey.ping', 'Valkey', 'DEGRADED', Date.now() - start, `Unexpected: ${pong}`);
  } catch (error) {
    return makeResult('valkey.ping', 'Valkey', 'UNHEALTHY', Date.now() - start,
      error instanceof Error ? error.message : 'Connection failed');
  }
}

async function checkTypesenseHealth(): Promise<HealthCheckResult> {
  const start = Date.now();
  // Platform settings takes precedence over env var
  const url = await getPlatformSetting('infrastructure.typesense.url', process.env.TYPESENSE_URL ?? '');
  if (!url) return makeResult('typesense.health', 'Typesense', 'UNKNOWN', 0, 'TYPESENSE_URL not configured');
  try {
    const resp = await withTimeout(fetch(`${url}/health`), TIMEOUT_MS);
    const status = resp.ok ? 'HEALTHY' : 'DEGRADED';
    return makeResult('typesense.health', 'Typesense', status, Date.now() - start,
      resp.ok ? null : `HTTP ${resp.status}`);
  } catch (error) {
    return makeResult('typesense.health', 'Typesense', 'UNHEALTHY', Date.now() - start,
      error instanceof Error ? error.message : 'Connection failed');
  }
}

async function checkCentrifugoHealth(): Promise<HealthCheckResult> {
  const start = Date.now();
  // Platform settings takes precedence over env var
  const url = await getPlatformSetting('infrastructure.centrifugo.apiUrl', process.env.CENTRIFUGO_API_URL ?? '');
  if (!url) return makeResult('centrifugo.health', 'Centrifugo', 'UNKNOWN', 0, 'CENTRIFUGO_API_URL not configured');
  try {
    // Any HTTP response (even 4xx) means the server is up — only connection error = UNHEALTHY
    await withTimeout(fetch(url, { method: 'GET' }), TIMEOUT_MS);
    return makeResult('centrifugo.health', 'Centrifugo', 'HEALTHY', Date.now() - start, null);
  } catch (error) {
    return makeResult('centrifugo.health', 'Centrifugo', 'UNHEALTHY', Date.now() - start,
      error instanceof Error ? error.message : 'Connection failed');
  }
}

export interface DoctorCheck {
  name: string;
  module: string;
  fn: () => Promise<HealthCheckResult>;
}

export const DOCTOR_CHECKS: DoctorCheck[] = [
  { name: 'db.connection', module: 'Database', fn: checkDbConnection },
  { name: 'db.pool', module: 'Database', fn: checkDbPool },
  { name: 'app.env', module: 'App', fn: checkAppEnv },
  { name: 'app.settings', module: 'App', fn: checkAppSettings },
  { name: 'valkey.ping', module: 'Valkey', fn: checkValkeyPing },
  { name: 'typesense.health', module: 'Typesense', fn: checkTypesenseHealth },
  { name: 'centrifugo.health', module: 'Centrifugo', fn: checkCentrifugoHealth },
];
