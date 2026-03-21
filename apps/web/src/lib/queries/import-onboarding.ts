/**
 * Import onboarding state query.
 * Determines first-time crosslister experience for a seller.
 * Source: G1-C install prompt §File 1
 */

import { db } from '@twicely/db';
import { crosslisterAccount, importBatch, sellerProfile } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { getChannelMetadata, CHANNEL_REGISTRY } from '@twicely/crosslister/channel-registry';
import type { ExternalChannel } from '@twicely/crosslister/types';

function isExternalChannel(ch: string): ch is ExternalChannel {
  return CHANNEL_REGISTRY.has(ch as ExternalChannel);
}

export interface ImportOnboardingState {
  /** Any crosslisterAccount rows for this seller */
  hasConnectedAccounts: boolean;
  /** Any crosslisterAccount with status = 'ACTIVE' */
  hasActiveAccounts: boolean;
  /** Any importBatch with status = 'COMPLETED' or 'PARTIALLY_COMPLETED' */
  hasCompletedImport: boolean;
  /** Display names of channels with ACTIVE accounts */
  connectedChannels: string[];
  /** Display names of ACTIVE accounts where firstImportCompletedAt IS NULL */
  availableImportChannels: string[];
  /** Current ListerTier from sellerProfile; 'NONE' if no profile */
  listerTier: string;
}

/**
 * Gather all data needed to render the import onboarding experience.
 * All queries are parallelized.
 * Ownership: sellerId maps directly to userId on crosslisterAccount.
 */
export async function getImportOnboardingState(
  userId: string,
): Promise<ImportOnboardingState> {
  const [accounts, batches, profileRow] = await Promise.all([
    db
      .select({
        status: crosslisterAccount.status,
        channel: crosslisterAccount.channel,
        firstImportCompletedAt: crosslisterAccount.firstImportCompletedAt,
      })
      .from(crosslisterAccount)
      .where(eq(crosslisterAccount.sellerId, userId)),

    db
      .select({ status: importBatch.status })
      .from(importBatch)
      .where(eq(importBatch.sellerId, userId)),

    db
      .select({ listerTier: sellerProfile.listerTier })
      .from(sellerProfile)
      .where(eq(sellerProfile.userId, userId))
      .limit(1),
  ]);

  const hasConnectedAccounts = accounts.length > 0;
  const activeAccounts = accounts.filter((a) => a.status === 'ACTIVE');
  const hasActiveAccounts = activeAccounts.length > 0;

  const hasCompletedImport = batches.some(
    (b) => b.status === 'COMPLETED' || b.status === 'PARTIALLY_COMPLETED',
  );

  const connectedChannels = activeAccounts.map((a) =>
    isExternalChannel(a.channel) ? getChannelMetadata(a.channel).displayName : a.channel,
  );

  const availableImportChannels = activeAccounts
    .filter((a) => a.firstImportCompletedAt === null)
    .map((a) =>
      isExternalChannel(a.channel) ? getChannelMetadata(a.channel).displayName : a.channel,
    );

  const listerTier = profileRow[0]?.listerTier ?? 'NONE';

  return {
    hasConnectedAccounts,
    hasActiveAccounts,
    hasCompletedImport,
    connectedChannels,
    availableImportChannels,
    listerTier,
  };
}
