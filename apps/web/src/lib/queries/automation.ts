/**
 * Automation queries — subscription status and settings read layer.
 * Source: F6 install prompt §A.3, §B.5
 */

import { db } from '@twicely/db';
import {
  sellerProfile,
  automationSubscription,
  automationSetting,
  crosslisterAccount,
} from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { getAutomationActionCount } from '@twicely/crosslister/services/automation-meter';
import type { ListerTier } from '@/types/enums';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AutomationSubscriptionStatus {
  hasAutomation: boolean;
  listerTier: ListerTier;
  automationSub: {
    status: string;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
  } | null;
  actionsUsed: number;
  actionsLimit: number;
  actionsRemaining: number;
}

export interface AutomationSettingsWithAccounts {
  settings: {
    id: string;
    autoRelistEnabled: boolean;
    autoRelistDays: number;
    autoRelistChannels: string[];
    offerToLikersEnabled: boolean;
    offerDiscountPercent: number;
    offerMinDaysListed: number;
    priceDropEnabled: boolean;
    priceDropPercent: number;
    priceDropIntervalDays: number;
    priceDropFloorPercent: number;
    poshShareEnabled: boolean;
    poshShareTimesPerDay: number;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  hasPoshmarkAccount: boolean;
  connectedChannels: string[];
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/**
 * Get automation subscription status and action metering for a seller.
 * @param userId - session.userId (ownership key)
 */
export async function getAutomationSubscriptionStatus(
  userId: string,
): Promise<AutomationSubscriptionStatus> {
  // Load sellerProfile to get listerTier + hasAutomation + sellerProfileId
  const [profile] = await db
    .select({
      id: sellerProfile.id,
      hasAutomation: sellerProfile.hasAutomation,
      listerTier: sellerProfile.listerTier,
    })
    .from(sellerProfile)
    .where(eq(sellerProfile.userId, userId))
    .limit(1);

  if (!profile) {
    return {
      hasAutomation: false,
      listerTier: 'NONE',
      automationSub: null,
      actionsUsed: 0,
      actionsLimit: 0,
      actionsRemaining: 0,
    };
  }

  const [autoSub, actionsLimit] = await Promise.all([
    db
      .select({
        status: automationSubscription.status,
        currentPeriodEnd: automationSubscription.currentPeriodEnd,
        cancelAtPeriodEnd: automationSubscription.cancelAtPeriodEnd,
      })
      .from(automationSubscription)
      .where(eq(automationSubscription.sellerProfileId, profile.id))
      .limit(1),
    getPlatformSetting<number>('automation.actionsPerMonth', 2000),
  ]);

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const actionsUsed = await getAutomationActionCount(userId, monthStart);

  return {
    hasAutomation: profile.hasAutomation,
    listerTier: profile.listerTier as ListerTier,
    automationSub: autoSub[0] ?? null,
    actionsUsed,
    actionsLimit,
    actionsRemaining: Math.max(0, actionsLimit - actionsUsed),
  };
}

/**
 * Get the automation settings row for a seller plus connected account info.
 * @param userId - session.userId (ownership key)
 */
export async function getAutomationSettings(
  userId: string,
): Promise<AutomationSettingsWithAccounts> {
  const [settingsRow, accounts] = await Promise.all([
    db
      .select({
        id: automationSetting.id,
        autoRelistEnabled: automationSetting.autoRelistEnabled,
        autoRelistDays: automationSetting.autoRelistDays,
        autoRelistChannels: automationSetting.autoRelistChannels,
        offerToLikersEnabled: automationSetting.offerToLikersEnabled,
        offerDiscountPercent: automationSetting.offerDiscountPercent,
        offerMinDaysListed: automationSetting.offerMinDaysListed,
        priceDropEnabled: automationSetting.priceDropEnabled,
        priceDropPercent: automationSetting.priceDropPercent,
        priceDropIntervalDays: automationSetting.priceDropIntervalDays,
        priceDropFloorPercent: automationSetting.priceDropFloorPercent,
        poshShareEnabled: automationSetting.poshShareEnabled,
        poshShareTimesPerDay: automationSetting.poshShareTimesPerDay,
        createdAt: automationSetting.createdAt,
        updatedAt: automationSetting.updatedAt,
      })
      .from(automationSetting)
      .where(eq(automationSetting.sellerId, userId))
      .limit(1),
    db
      .select({ channel: crosslisterAccount.channel })
      .from(crosslisterAccount)
      .where(
        and(
          eq(crosslisterAccount.sellerId, userId),
          eq(crosslisterAccount.status, 'ACTIVE'),
        ),
      ),
  ]);

  const connectedChannels = accounts.map((a) => a.channel as string);
  const hasPoshmarkAccount = connectedChannels.includes('POSHMARK');

  return {
    settings: settingsRow[0] ?? null,
    hasPoshmarkAccount,
    connectedChannels,
  };
}
