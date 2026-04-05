'use server';

/**
 * On-demand payout request action (§5.1 + §5.4).
 * Enforces tier-specific minimums, instant payout fees, cooldown, and PERSONAL seller gate.
 */

import { db } from '@twicely/db';
import { sellerProfile, payout as payoutTable, auditEvent } from '@twicely/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { authorize, sub } from '@twicely/casl';
import { z } from 'zod';
import { stripe } from '@twicely/stripe/server';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { getValkeyClient } from '@twicely/db/cache';
import { logger } from '@twicely/logger';

type StoreTier = 'NONE' | 'STARTER' | 'PRO' | 'POWER' | 'ENTERPRISE';

const requestPayoutSchema = z.object({
  amountCents: z.number().int().positive(),
  instant: z.boolean().default(false),
}).strict();

export interface RequestPayoutResult {
  success: boolean;
  payoutId?: string;
  amountCents?: number;
  feeCents?: number;
  error?: string;
}

/** Tier-minimum payout keys from platform_settings (§5.4). */
const TIER_MINIMUM_KEY: Record<StoreTier, string> = {
  NONE: 'payout.minimumNoneCents',
  STARTER: 'payout.minimumStarterCents',
  PRO: 'payout.minimumProCents',
  POWER: 'payout.minimumPowerCents',
  ENTERPRISE: 'payout.minimumEnterpriseCents',
};

const TIER_MINIMUM_FALLBACK: Record<StoreTier, number> = {
  NONE: 1500, STARTER: 1000, PRO: 100, POWER: 100, ENTERPRISE: 0,
};

const INSTANT_ELIGIBLE_TIERS: StoreTier[] = ['STARTER', 'PRO', 'POWER', 'ENTERPRISE'];

/**
 * Request an on-demand payout to the seller's bank account.
 *
 * Enforces: CASL gate, tier-specific minimums, PERSONAL seller gate,
 * instant payout fee/max/eligibility, 24h cooldown, Stripe payout creation.
 */
export async function requestPayoutAction(
  amountCents: number,
  instant: boolean = false,
): Promise<RequestPayoutResult> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Please sign in to continue' };

  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;
  if (!ability.can('create', sub('Payout', { userId }))) {
    return { success: false, error: 'Not authorized' };
  }

  const parsed = requestPayoutSchema.safeParse({ amountCents, instant });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  // Load seller profile
  const [profile] = await db
    .select({
      stripeAccountId: sellerProfile.stripeAccountId,
      stripeOnboarded: sellerProfile.stripeOnboarded,
      storeTier: sellerProfile.storeTier,
      sellerType: sellerProfile.sellerType,
    })
    .from(sellerProfile)
    .where(eq(sellerProfile.userId, userId))
    .limit(1);

  if (!profile?.stripeAccountId || !profile.stripeOnboarded) {
    return { success: false, error: 'Stripe account not connected' };
  }

  const tier = (profile.storeTier ?? 'NONE') as StoreTier;

  // ── Tier-specific minimum ────────────────────────────────────────────
  const minimumCents = await getPlatformSetting<number>(TIER_MINIMUM_KEY[tier], TIER_MINIMUM_FALLBACK[tier]);
  if (parsed.data.amountCents < minimumCents) {
    const minDisplay = `$${(minimumCents / 100).toFixed(2)}`;
    return { success: false, error: `Minimum payout for your plan is ${minDisplay}.` };
  }

  // ── Distributed lock to prevent concurrent payout requests (SEC-007) ──
  const lockKey = `payout-lock:${userId}`;
  let lockAcquired = false;
  try {
    const valkey = getValkeyClient();
    const result = await valkey.set(lockKey, '1', 'EX', 30, 'NX');
    lockAcquired = result === 'OK';
  } catch {
    // If Valkey is down, fall through to DB check — still safer than nothing
  }
  if (!lockAcquired) {
    return { success: false, error: 'A payout request is already in progress. Please wait and try again.' };
  }

  try {
  // ── On-demand cooldown (24h default) ─────────────────────────────────
  const cooldownKey = `payout-cooldown:${userId}`;
  const cooldownHours = await getPlatformSetting<number>('payout.onDemandCooldownHours', 24);
  const [lastOnDemandPayout] = await db
    .select({ initiatedAt: payoutTable.initiatedAt })
    .from(payoutTable)
    .where(and(
      eq(payoutTable.userId, userId),
      eq(payoutTable.isOnDemand, true),
    ))
    .orderBy(desc(payoutTable.initiatedAt))
    .limit(1);

  if (
    lastOnDemandPayout?.initiatedAt &&
    lastOnDemandPayout.initiatedAt.getTime() > Date.now() - cooldownHours * 60 * 60 * 1000
  ) {
    return {
      success: false,
      error: `You can only request one payout every ${cooldownHours} hours. Please try again later.`,
    };
  }

  try {
    const valkey = getValkeyClient();
    const inCooldown = await valkey.get(cooldownKey);
    if (inCooldown) {
      return { success: false, error: `You can only request one payout every ${cooldownHours} hours. Please try again later.` };
    }
  } catch (err) {
    logger.warn('[requestPayout] Valkey cooldown check failed, using DB cooldown only', {
      userId,
      error: String(err),
    });
  }

  // ── Instant payout validation ────────────────────────────────────────
  let feeCents = 0;
  let stripeMethod: 'standard' | 'instant' = 'standard';

  if (parsed.data.instant) {
    if (profile.sellerType === 'PERSONAL') {
      return { success: false, error: 'Personal sellers can only use standard payouts.' };
    }
    if (!INSTANT_ELIGIBLE_TIERS.includes(tier)) {
      return { success: false, error: 'Instant payouts require Starter plan or higher.' };
    }

    const instantEnabled = await getPlatformSetting<boolean>('payout.instantEnabled', true);
    if (!instantEnabled) return { success: false, error: 'Instant payouts are temporarily unavailable.' };

    if (tier !== 'ENTERPRISE') {
      const instantMaxCents = await getPlatformSetting<number>('payout.instantMaxCents', 25000);
      if (parsed.data.amountCents > instantMaxCents) {
        return { success: false, error: `Instant payouts limited to $${(instantMaxCents / 100).toFixed(2)}.` };
      }
      feeCents = await getPlatformSetting<number>('payout.instantFeeCents', 250);
    }
    // ENTERPRISE: no fee, no max cap (negotiated — §5.1)
    stripeMethod = 'instant';
  }

  // ── Stripe payout (net of instant fee — Decision #89) ───────────────
  const netPayoutCents = parsed.data.amountCents - feeCents;
  let stripePayoutId: string;
  try {
    const stripePayout = await stripe.payouts.create(
      {
        amount: netPayoutCents,
        currency: 'usd',
        method: stripeMethod,
        metadata: { userId, tier, instant: String(parsed.data.instant), feeCents: String(feeCents), grossAmountCents: String(parsed.data.amountCents) },
      },
      { stripeAccount: profile.stripeAccountId },
    );
    stripePayoutId = stripePayout.id;
  } catch (err) {
    logger.error('[requestPayout] Stripe payout failed', { userId, tier, error: err });
    return { success: false, error: 'Payout could not be initiated. Please try again or contact support.' };
  }

  // ── Persist payout record (mandatory — must succeed for webhook reconciliation) ──
  try {
    await db.insert(payoutTable).values({
      userId,
      status: 'PENDING',
      amountCents: netPayoutCents,
      feeCents,
      isInstant: stripeMethod === 'instant',
      stripePayoutId,
      isOnDemand: true,
      initiatedAt: new Date(),
    });
  } catch (err) {
    logger.error('[requestPayout] Payout DB insert failed — attempting Stripe cancellation', {
      userId, payoutId: stripePayoutId, error: String(err),
    });
    try {
      await stripe.payouts.cancel(stripePayoutId, undefined, { stripeAccount: profile.stripeAccountId });
    } catch (cancelErr) {
      logger.error('[requestPayout] CRITICAL: DB insert failed AND Stripe cancel failed — manual reconciliation required', {
        userId, payoutId: stripePayoutId, cancelError: String(cancelErr),
      });
    }
    return { success: false, error: 'Payout could not be recorded. Please try again or contact support.' };
  }

  // ── Set cooldown AFTER successful DB insert (avoids lockout on DB failure) ──
  try {
    const valkey = getValkeyClient();
    await valkey.set(cooldownKey, '1', 'EX', cooldownHours * 3600);
  } catch (err) {
    logger.warn('[requestPayout] Cooldown cache hint set failed', {
      userId,
      payoutId: stripePayoutId,
      error: String(err),
    });
  }

  // ── Audit event ──────────────────────────────────────────────────────
  try {
    await db.insert(auditEvent).values({
      actorType: 'USER',
      actorId: userId,
      action: 'PAYOUT_REQUESTED',
      subject: 'Payout',
      subjectId: stripePayoutId,
      severity: 'LOW',
      detailsJson: { grossAmountCents: parsed.data.amountCents, netAmountCents: netPayoutCents, feeCents, instant: parsed.data.instant, tier, stripePayoutId },
    });
  } catch (err) {
    logger.warn('[requestPayout] Audit insert failed', { userId, payoutId: stripePayoutId, error: String(err) });
  }

  return { success: true, payoutId: stripePayoutId, amountCents: netPayoutCents, feeCents };
  } finally {
    // Release distributed lock (SEC-007)
    try {
      const valkey = getValkeyClient();
      await valkey.del(lockKey);
    } catch {
      // Lock will auto-expire in 30s if Valkey delete fails
    }
  }
}
