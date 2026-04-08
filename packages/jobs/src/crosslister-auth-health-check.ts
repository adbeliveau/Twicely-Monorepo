/**
 * Crosslister account auth health check BullMQ job.
 * Runs hourly (default) to detect crosslister accounts whose auth is:
 *   1. About to expire (OAuth tokenExpiresAt within warnAheadHours)
 *   2. Already expired (tokenExpiresAt in the past)
 *   3. Stuck in error (consecutiveErrors >= errorThreshold)
 *   4. Silently stale (lastSyncAt older than staleAfterDays — covers session
 *      cookies that went bad without raising an error)
 *
 * When detected, the account's status flips to REAUTHENTICATION_REQUIRED
 * and a crosslister.account.reauth_required notification is dispatched.
 * Both transitions are idempotent — re-running the job does not re-notify
 * an already-flagged account.
 */

import { createQueue, createWorker } from './queue';
import { db } from '@twicely/db';
import { crosslisterAccount } from '@twicely/db/schema';
import { eq, and, or, lt, lte, gte, isNotNull } from 'drizzle-orm';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { logger } from '@twicely/logger';
import type { TemplateKey } from '@twicely/notifications/templates-types';

const QUEUE_NAME = 'crosslister-auth-health-check';

interface AuthHealthJobData {
  triggeredAt: string;
}

export const crosslisterAuthHealthQueue = createQueue<AuthHealthJobData>(QUEUE_NAME);

export async function registerCrosslisterAuthHealthJob(): Promise<void> {
  const pattern = await getPlatformSetting('jobs.cron.crosslisterAuthHealth.pattern', '15 * * * *');
  await crosslisterAuthHealthQueue.add(
    'crosslister-auth-health-check',
    { triggeredAt: new Date().toISOString() },
    {
      jobId: 'crosslister-auth-health-check',
      repeat: { pattern, tz: 'UTC' },
      removeOnComplete: true,
      removeOnFail: { count: 100 },
    },
  );
  logger.info('[crosslisterAuthHealth] Registered auth health check cron job');
}

export interface AuthHealthResult {
  expired: number;
  expiringSoon: number;
  errorThreshold: number;
  stale: number;
  notified: number;
  errors: number;
}

export async function processCrosslisterAuthHealth(
  notifyFn: (userId: string, key: TemplateKey, data: Record<string, string>) => Promise<void>,
): Promise<AuthHealthResult> {
  const [warnAheadHours, errorThreshold, staleAfterDays] = await Promise.all([
    getPlatformSetting('crosslister.auth.warnAheadHours', 48),
    getPlatformSetting('crosslister.auth.errorThreshold', 3),
    getPlatformSetting('crosslister.auth.staleAfterDays', 7),
  ]);

  const now = new Date();
  const warnAheadMs = Number(warnAheadHours) * 60 * 60 * 1000;
  const staleAfterMs = Number(staleAfterDays) * 24 * 60 * 60 * 1000;
  const warnThreshold = new Date(now.getTime() + warnAheadMs);
  const staleThreshold = new Date(now.getTime() - staleAfterMs);

  const result: AuthHealthResult = {
    expired: 0,
    expiringSoon: 0,
    errorThreshold: 0,
    stale: 0,
    notified: 0,
    errors: 0,
  };

  // Find candidates: any ACTIVE account that meets ANY of the four criteria.
  // Accounts already in REAUTHENTICATION_REQUIRED are skipped (idempotency).
  const candidates = await db
    .select({
      id: crosslisterAccount.id,
      sellerId: crosslisterAccount.sellerId,
      channel: crosslisterAccount.channel,
      externalUsername: crosslisterAccount.externalUsername,
      authMethod: crosslisterAccount.authMethod,
      tokenExpiresAt: crosslisterAccount.tokenExpiresAt,
      lastSyncAt: crosslisterAccount.lastSyncAt,
      consecutiveErrors: crosslisterAccount.consecutiveErrors,
    })
    .from(crosslisterAccount)
    .where(
      and(
        eq(crosslisterAccount.status, 'ACTIVE'),
        or(
          // OAuth: token already expired
          and(
            isNotNull(crosslisterAccount.tokenExpiresAt),
            lt(crosslisterAccount.tokenExpiresAt, now),
          ),
          // OAuth: token expiring within warn window
          and(
            isNotNull(crosslisterAccount.tokenExpiresAt),
            lte(crosslisterAccount.tokenExpiresAt, warnThreshold),
            gte(crosslisterAccount.tokenExpiresAt, now),
          ),
          // Error threshold reached
          gte(crosslisterAccount.consecutiveErrors, Number(errorThreshold)),
          // Session cookies likely stale (no recent sync)
          and(
            isNotNull(crosslisterAccount.lastSyncAt),
            lt(crosslisterAccount.lastSyncAt, staleThreshold),
          ),
        ),
      ),
    );

  for (const account of candidates) {
    try {
      // Determine which trigger fired for this account (for notification body).
      let reason: 'expired' | 'expiring_soon' | 'error_threshold' | 'stale';
      if (account.tokenExpiresAt && account.tokenExpiresAt < now) {
        reason = 'expired';
        result.expired++;
      } else if (
        account.tokenExpiresAt &&
        account.tokenExpiresAt <= warnThreshold
      ) {
        reason = 'expiring_soon';
        result.expiringSoon++;
      } else if (account.consecutiveErrors >= Number(errorThreshold)) {
        reason = 'error_threshold';
        result.errorThreshold++;
      } else {
        reason = 'stale';
        result.stale++;
      }

      // Flip status to REAUTHENTICATION_REQUIRED (idempotent: only if still ACTIVE)
      const updated = await db
        .update(crosslisterAccount)
        .set({
          status: 'REAUTHENTICATION_REQUIRED',
          updatedAt: now,
        })
        .where(
          and(
            eq(crosslisterAccount.id, account.id),
            eq(crosslisterAccount.status, 'ACTIVE'),
          ),
        )
        .returning({ id: crosslisterAccount.id });

      if (updated.length === 0) {
        // Another worker already flipped it — skip notification to stay idempotent.
        continue;
      }

      await notifyFn(account.sellerId, 'crosslister.account.reauth_required', {
        channel: account.channel,
        channelLabel: formatChannelLabel(account.channel),
        accountId: account.id,
        externalUsername: account.externalUsername ?? '',
        reason,
        reasonLabel: formatReasonLabel(reason),
      });

      result.notified++;
    } catch (err) {
      logger.error('[crosslisterAuthHealth] Error processing account', {
        accountId: account.id,
        sellerId: account.sellerId,
        err: String(err),
      });
      result.errors++;
    }
  }

  logger.info('[crosslisterAuthHealth] Complete', {
    candidates: candidates.length,
    ...result,
  });

  return result;
}

function formatChannelLabel(channel: string): string {
  const labels: Record<string, string> = {
    EBAY: 'eBay',
    ETSY: 'Etsy',
    SHOPIFY: 'Shopify',
    WHATNOT: 'Whatnot',
    GRAILED: 'Grailed',
    DEPOP: 'Depop',
    MERCARI: 'Mercari',
    FB_MARKETPLACE: 'Facebook Marketplace',
    POSHMARK: 'Poshmark',
    THEREALREAL: 'The RealReal',
    VESTIAIRE: 'Vestiaire Collective',
  };
  return labels[channel] ?? channel;
}

function formatReasonLabel(reason: 'expired' | 'expiring_soon' | 'error_threshold' | 'stale'): string {
  switch (reason) {
    case 'expired':
      return 'Your authorization has expired';
    case 'expiring_soon':
      return 'Your authorization is about to expire';
    case 'error_threshold':
      return 'Your account has been disconnected due to repeated errors';
    case 'stale':
      return 'Your session appears to have expired';
  }
}

export function createCrosslisterAuthHealthWorker(
  notifyFn: (userId: string, key: TemplateKey, data: Record<string, string>) => Promise<void>,
) {
  return createWorker<AuthHealthJobData>(
    QUEUE_NAME,
    async () => {
      await processCrosslisterAuthHealth(notifyFn);
    },
    1, // single concurrency — avoid duplicate processing
  );
}

// ─── Auto-instantiated worker ────────────────────────────────────────────────
// Dynamic import of @twicely/notifications to avoid circular dep at compile time.

void (async () => {
  const { notify } = await import('@twicely/notifications/service');
  createCrosslisterAuthHealthWorker(notify);
})();
