/**
 * Account Security Event Service (Canonical 26 §6.5)
 *
 * Records security events (logins, password changes, etc.) and
 * auto-generates risk signals when suspicious patterns are detected.
 *
 * Pattern detection thresholds are read from platform_settings.
 */

import { db } from '@twicely/db';
import { accountSecurityEvent } from '@twicely/db/schema';
import { eq, and, gte, desc } from 'drizzle-orm';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { logger } from '@twicely/logger';
import type { RecordSecurityEventArgs } from './types';
import { recordRiskSignal } from './signals';

/**
 * Record a security event and auto-generate risk signals for suspicious patterns.
 *
 * Auto-signal rules:
 * - 3+ login failures in 15min -> LOGIN_FAILURES signal
 * - New device not seen in last 10 events -> DEVICE_CHANGE signal
 * - Login from new /16 subnet not seen in 30 days -> GEO_ANOMALY signal
 *
 * @returns The inserted security event row
 */
export async function recordSecurityEvent(args: RecordSecurityEventArgs) {
  const {
    userId,
    eventType,
    ipAddress,
    userAgent,
    deviceId,
    location,
    success = true,
    meta = {},
  } = args;

  // Insert the event
  const [inserted] = await db
    .insert(accountSecurityEvent)
    .values({
      userId,
      eventType,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
      deviceId: deviceId ?? null,
      location: location ?? null,
      success,
      metaJson: meta,
    })
    .returning();

  logger.info('Security event recorded', {
    eventId: inserted.id,
    userId,
    eventType,
    success,
  });

  // Auto-generate risk signals based on patterns
  try {
    await checkLoginFailurePattern(userId, eventType, success);
    await checkDeviceChangePattern(userId, deviceId);
    await checkGeoAnomalyPattern(userId, ipAddress);
  } catch (err) {
    // Auto-signal generation is non-fatal
    logger.warn('Auto-signal generation failed', {
      userId,
      eventType,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return inserted;
}

/**
 * Get security events for a user with optional filters.
 */
export async function getSecurityEvents(
  userId: string,
  filters?: {
    eventType?: string;
    success?: boolean;
    since?: Date;
    limit?: number;
  }
) {
  const conditions = [eq(accountSecurityEvent.userId, userId)];

  if (filters?.eventType) {
    conditions.push(eq(accountSecurityEvent.eventType, filters.eventType));
  }
  if (filters?.success !== undefined) {
    conditions.push(eq(accountSecurityEvent.success, filters.success));
  }
  if (filters?.since) {
    conditions.push(gte(accountSecurityEvent.occurredAt, filters.since));
  }

  return db
    .select()
    .from(accountSecurityEvent)
    .where(and(...conditions))
    .orderBy(desc(accountSecurityEvent.occurredAt))
    .limit(filters?.limit ?? 100);
}

// ─── Pattern detectors (auto-signal generation) ─────────────────────────────

/**
 * Check for excessive login failures in a short window.
 * If failures >= threshold within window -> generate LOGIN_FAILURES signal.
 */
async function checkLoginFailurePattern(
  userId: string,
  eventType: string,
  success: boolean
): Promise<void> {
  // Only check on login failure events
  if (eventType !== 'login_failure' && !(eventType === 'login' && !success)) {
    return;
  }

  const threshold = await getPlatformSetting<number>('risk.security.loginFailureThreshold', 3);
  const windowMinutes = await getPlatformSetting<number>('risk.security.loginFailureWindowMinutes', 15);
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

  const recentFailures = await db
    .select({ id: accountSecurityEvent.id })
    .from(accountSecurityEvent)
    .where(
      and(
        eq(accountSecurityEvent.userId, userId),
        eq(accountSecurityEvent.success, false),
        gte(accountSecurityEvent.occurredAt, windowStart)
      )
    );

  if (recentFailures.length >= threshold) {
    await recordRiskSignal({
      userId,
      signalType: 'login_failures',
      source: 'security-event-auto',
      meta: {
        failureCount: recentFailures.length,
        windowMinutes,
        threshold,
      },
    });
  }
}

/**
 * Check if the device is new (not seen in last 10 events).
 * If device is new -> generate DEVICE_CHANGE signal.
 */
async function checkDeviceChangePattern(
  userId: string,
  deviceId: string | undefined
): Promise<void> {
  if (!deviceId) return;

  const recentEvents = await db
    .select({ deviceId: accountSecurityEvent.deviceId })
    .from(accountSecurityEvent)
    .where(eq(accountSecurityEvent.userId, userId))
    .orderBy(desc(accountSecurityEvent.occurredAt))
    .limit(10);

  const knownDevices = new Set(
    recentEvents.map((e: { deviceId: string | null }) => e.deviceId).filter((d): d is string => d !== null)
  );

  // If device is not in the last 10 events, it's new
  // (we exclude the just-inserted event by checking set size > 0 before membership)
  if (knownDevices.size > 0 && !knownDevices.has(deviceId)) {
    await recordRiskSignal({
      userId,
      signalType: 'device_change',
      source: 'security-event-auto',
      meta: { newDeviceId: deviceId },
    });
  }
}

/**
 * Check if the IP is from a new /16 subnet not seen in 30 days.
 * If subnet is new -> generate GEO_ANOMALY signal.
 */
async function checkGeoAnomalyPattern(
  userId: string,
  ipAddress: string | undefined
): Promise<void> {
  if (!ipAddress) return;

  const subnet = extractSubnet16(ipAddress);
  if (!subnet) return;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const recentEvents = await db
    .select({ ipAddress: accountSecurityEvent.ipAddress })
    .from(accountSecurityEvent)
    .where(
      and(
        eq(accountSecurityEvent.userId, userId),
        gte(accountSecurityEvent.occurredAt, thirtyDaysAgo)
      )
    );

  const knownSubnets = new Set(
    recentEvents
      .map((e: { ipAddress: string | null }) => e.ipAddress)
      .filter((addr): addr is string => addr !== null)
      .map((ip: string) => extractSubnet16(ip))
      .filter((s): s is string => s !== null)
  );

  // If this subnet has not been seen in the past 30 days and there's history
  if (knownSubnets.size > 0 && !knownSubnets.has(subnet)) {
    await recordRiskSignal({
      userId,
      signalType: 'geo_anomaly',
      source: 'security-event-auto',
      meta: { ipAddress, subnet },
    });
  }
}

/**
 * Extract the /16 subnet from an IPv4 address.
 * E.g., "192.168.1.100" -> "192.168"
 */
function extractSubnet16(ip: string): string | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  return `${parts[0]}.${parts[1]}`;
}
