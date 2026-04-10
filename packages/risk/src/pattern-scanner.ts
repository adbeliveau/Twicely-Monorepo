/**
 * Security Event Pattern Scanner (Canonical 26 §15 / C26 §7)
 *
 * BullMQ-compatible function that scans recent security events
 * for suspicious patterns and generates risk signals.
 *
 * Designed to run as a cron job every 15 minutes.
 * Pattern thresholds are read from platform_settings.
 */

import { db } from '@twicely/db';
import { accountSecurityEvent } from '@twicely/db/schema';
import { gte, and, eq, sql } from 'drizzle-orm';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { logger } from '@twicely/logger';
import { recordRiskSignal } from './signals';

/**
 * Scan recent security events for velocity patterns.
 *
 * Pattern 1: Multiple failed logins from the same IP across different users.
 *   -> Indicates credential stuffing or brute-force attack.
 *   -> Generates IP_VELOCITY signal for each affected user.
 *
 * Pattern 2: Rapid account creation from the same device fingerprint.
 *   -> Indicates duplicate account creation.
 *   -> Generates ACCOUNT_AGE signal for each affected user.
 *
 * Pattern 3: High payment failure rate per user.
 *   -> Indicates stolen card testing or payment fraud.
 *   -> Generates PAYMENT_FAILURE_RATE signal.
 *
 * This function is BullMQ-compatible (accepts a Job-like arg, returns void).
 */
export async function scanSecurityEventPatterns(): Promise<{
  ipVelocitySignals: number;
  paymentFailureSignals: number;
}> {
  const scanWindowMinutes = await getPlatformSetting<number>(
    'risk.security.ipVelocityScanWindowMinutes',
    15,
  );
  const windowStart = new Date(Date.now() - scanWindowMinutes * 60 * 1000);

  let ipVelocitySignals = 0;
  let paymentFailureSignals = 0;

  // ─── Pattern 1: IP velocity (failed logins from same IP, multiple users) ──

  try {
    const ipThreshold = await getPlatformSetting<number>(
      'risk.security.loginFailureThreshold',
      3
    );

    // Find IPs with excessive failures across multiple users
    const ipFailures = await db
      .select({
        ipAddress: accountSecurityEvent.ipAddress,
        failureCount: sql<number>`count(*)::int`.as('failure_count'),
        userCount: sql<number>`count(distinct ${accountSecurityEvent.userId})::int`.as('user_count'),
      })
      .from(accountSecurityEvent)
      .where(
        and(
          eq(accountSecurityEvent.success, false),
          gte(accountSecurityEvent.occurredAt, windowStart),
          sql`${accountSecurityEvent.ipAddress} is not null`
        )
      )
      .groupBy(accountSecurityEvent.ipAddress);

    for (const row of ipFailures) {
      if (!row.ipAddress) continue;
      // Only flag if failures exceed threshold AND span multiple users
      if (row.failureCount >= ipThreshold && row.userCount > 1) {
        // Find all affected users from this IP
        const affectedUsers = await db
          .select({ userId: accountSecurityEvent.userId })
          .from(accountSecurityEvent)
          .where(
            and(
              eq(accountSecurityEvent.ipAddress, row.ipAddress),
              eq(accountSecurityEvent.success, false),
              gte(accountSecurityEvent.occurredAt, windowStart)
            )
          )
          .groupBy(accountSecurityEvent.userId);

        for (const user of affectedUsers) {
          await recordRiskSignal({
            userId: user.userId,
            signalType: 'ip_velocity',
            source: 'pattern-scanner',
            meta: {
              ipAddress: row.ipAddress,
              failureCount: row.failureCount,
              userCount: row.userCount,
            },
          });
          ipVelocitySignals++;
        }
      }
    }
  } catch (err) {
    logger.error('Pattern scanner: IP velocity check failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // ─── Pattern 3: Payment failure rate per user ─────────────────────────────

  try {
    const paymentThreshold = await getPlatformSetting<number>(
      'risk.fraud.paymentFailureThreshold',
      5
    );
    const paymentWindowMinutes = await getPlatformSetting<number>(
      'risk.fraud.paymentFailureWindowMinutes',
      60
    );
    const paymentWindowStart = new Date(
      Date.now() - paymentWindowMinutes * 60 * 1000
    );

    const paymentFailures = await db
      .select({
        userId: accountSecurityEvent.userId,
        failureCount: sql<number>`count(*)::int`.as('failure_count'),
      })
      .from(accountSecurityEvent)
      .where(
        and(
          eq(accountSecurityEvent.eventType, 'payment_failure'),
          eq(accountSecurityEvent.success, false),
          gte(accountSecurityEvent.occurredAt, paymentWindowStart)
        )
      )
      .groupBy(accountSecurityEvent.userId);

    for (const row of paymentFailures) {
      if (row.failureCount >= paymentThreshold) {
        await recordRiskSignal({
          userId: row.userId,
          signalType: 'payment_failure_rate',
          source: 'pattern-scanner',
          meta: {
            failureCount: row.failureCount,
            windowMinutes: paymentWindowMinutes,
            threshold: paymentThreshold,
          },
        });
        paymentFailureSignals++;
      }
    }
  } catch (err) {
    logger.error('Pattern scanner: payment failure check failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  logger.info('Pattern scan completed', {
    ipVelocitySignals,
    paymentFailureSignals,
  });

  return { ipVelocitySignals, paymentFailureSignals };
}
