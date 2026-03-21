/**
 * Account Deletion Executor — G8.1
 *
 * BullMQ job: runs daily at 04:00 UTC as part of the cleanup queue.
 * Executes the GDPR right-to-erasure pipeline for users past their
 * 30-day cooling-off period.
 *
 * Per Feature Lock-in section 37 and Decision #110.
 * Financial records are PSEUDONYMIZED, never deleted.
 */

import { createQueue } from './queue';
import { db } from '@twicely/db';
import {
  user as userTable,
  address,
  taxInfo,
  auditEvent,
  dataExportRequest,
  crosslisterAccount,
  order,
  listing as listingTable,
  listingImage,
} from '@twicely/db/schema';
import { deleteImage } from '@twicely/storage/image-service';
import { eq, and, lt, isNotNull, inArray } from 'drizzle-orm';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { logger } from '@twicely/logger';
import { notify } from '@twicely/notifications/service';
import {
  generatePseudonym,
  pseudonymizeOrders,
  pseudonymizeLedgerEntries,
  pseudonymizePayouts,
  pseudonymizeMessages,
  pseudonymizeAuditEvents,
  pseudonymizeAffiliateRecords,
} from '@/lib/gdpr/pseudonymize';

export const CLEANUP_QUEUE_NAME = 'cleanup';

export interface CleanupJobData {
  task: 'account-deletion' | 'session-cleanup' | 'audit-archive' | 'data-purge';
  triggeredAt: string;
}

export const cleanupQueue = createQueue<CleanupJobData>(CLEANUP_QUEUE_NAME, {
  defaultJobOptions: {
    attempts: 2,
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 100 },
  },
});

/** Check blocking conditions for a userId (open orders as buyer or seller). */
async function hasBlockers(userId: string): Promise<boolean> {
  const openSellerOrders = await db
    .select({ id: order.id })
    .from(order)
    .where(
      and(
        eq(order.sellerId, userId),
        inArray(order.status, ['CREATED', 'PAID', 'SHIPPED'])
      )
    );
  if (openSellerOrders.length > 0) return true;

  const openBuyerOrders = await db
    .select({ id: order.id })
    .from(order)
    .where(
      and(
        eq(order.buyerId, userId),
        inArray(order.status, ['CREATED', 'PAID', 'SHIPPED'])
      )
    );
  return openBuyerOrders.length > 0;
}

/**
 * Execute account deletion for a single user.
 * Called only by the BullMQ job — NOT a server action.
 * Idempotent: safe to retry on partial failure.
 */
async function executeAccountDeletion(userId: string): Promise<void> {
  // Re-verify no blocking orders/disputes
  const blocked = await hasBlockers(userId);
  if (blocked) {
    logger.warn('[deletionExecutor] Skipping user with open orders', { userId });
    return;
  }

  // Fetch user before mutation (need email for confirmation)
  const [targetUser] = await db
    .select({ id: userTable.id, email: userTable.email })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);

  if (!targetUser) {
    logger.warn('[deletionExecutor] User not found', { userId });
    return;
  }

  const originalEmailDomain = targetUser.email.split('@')[1] ?? 'unknown';
  const pseudonym = generatePseudonym(userId);

  // Send confirmation email BEFORE clearing PII
  await notify(userId, 'privacy.deletion_completed', {});

  // Pseudonymize financial records (never hard-delete per Decision #110)
  await pseudonymizeOrders(userId, pseudonym);
  await pseudonymizeLedgerEntries(userId, pseudonym);
  await pseudonymizePayouts(userId, pseudonym);
  await pseudonymizeMessages(userId, pseudonym);
  await pseudonymizeAuditEvents(userId, pseudonym);
  await pseudonymizeAffiliateRecords(userId, pseudonym);

  // Remove listings from Typesense search index (gracefully skip — not yet wired in G8)
  // Typesense admin module will be available in a future phase; no-op until then.
  logger.info('[deletionExecutor] Typesense removal skipped (not yet wired)', { userId });

  // Delete listing images from R2
  const userListings = await db
    .select({ id: listingTable.id })
    .from(listingTable)
    .where(eq(listingTable.ownerUserId, userId));

  if (userListings.length > 0) {
    const listingIds = userListings.map((l) => l.id);
    const images = await db
      .select({ url: listingImage.url })
      .from(listingImage)
      .where(inArray(listingImage.listingId, listingIds));

    await Promise.allSettled(images.map((img) => deleteImage(img.url)));
    logger.info('[deletionExecutor] Listing images deleted from R2', {
      userId,
      imageCount: images.length,
    });
  }

  // Delete addresses (PII)
  await db.delete(address).where(eq(address.userId, userId));

  // Hard delete tax info (encrypted PII)
  await db.delete(taxInfo).where(eq(taxInfo.userId, userId));

  // Hard delete crosslister account tokens (sellerId is the FK on crosslisterAccount)
  await db.delete(crosslisterAccount).where(eq(crosslisterAccount.sellerId, userId));

  // Hard delete data export requests
  await db.delete(dataExportRequest).where(eq(dataExportRequest.userId, userId));

  // Hard delete user PII — set isBanned to prevent re-registration confusion
  await db
    .update(userTable)
    .set({
      name: pseudonym,
      email: `${pseudonym}@deleted.twicely.co`,
      phone: null,
      avatarUrl: null,
      bio: null,
      displayName: null,
      username: pseudonym,
      image: null,
      isBanned: true,
      bannedAt: new Date(),
      bannedReason: 'Account deleted per GDPR right-to-erasure',
      deletionRequestedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(userTable.id, userId));

  // Create CRITICAL audit event for the deletion
  await db.insert(auditEvent).values({
    actorType: 'SYSTEM',
    actorId: 'account-deletion-executor',
    action: 'ACCOUNT_DELETION_EXECUTED',
    subject: 'User',
    subjectId: pseudonym,
    severity: 'CRITICAL',
    detailsJson: {
      pseudonymized: true,
      originalEmailDomain,
    },
  });

  logger.info('[deletionExecutor] Account deletion completed', {
    userId,
    pseudonymPrefix: pseudonym.slice(0, 40),
  });
}

/** Process all users past their cooling-off period. Exported for cleanup-queue.ts. */
export async function runAccountDeletionBatch(): Promise<void> {
  const gracePeriodDays = await getPlatformSetting<number>(
    'gdpr.deletionGracePeriodDays',
    30
  );

  const cutoff = new Date(Date.now() - gracePeriodDays * 86400000);

  const candidates = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(
      and(
        isNotNull(userTable.deletionRequestedAt),
        lt(userTable.deletionRequestedAt, cutoff)
      )
    )
    .limit(100);

  logger.info('[deletionExecutor] Processing deletion candidates', {
    count: candidates.length,
  });

  for (const candidate of candidates) {
    try {
      await executeAccountDeletion(candidate.id);
    } catch (err) {
      logger.error('[deletionExecutor] Failed for user', {
        userId: candidate.id,
        err,
      });
    }
  }
}

