'use server';

/**
 * Admin Data Management Actions (I12)
 * Bulk listing status updates, bulk user ban/unban.
 * All actions are gated by CASL ability checks and audited.
 */

import { db } from '@twicely/db';
import { listing, user, auditEvent } from '@twicely/db/schema';
import { inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import {
  bulkListingUpdateSchema,
  bulkUserBanSchema,
  bulkUserUnbanSchema,
} from '@/lib/validations/data-management';

type ActionResult = { success: true } | { error: string };

// ─── Bulk Listing Status Update ───────────────────────────────────────────────

export async function bulkUpdateListingStatusAction(input: unknown): Promise<ActionResult> {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'Listing')) {
    return { error: 'Forbidden' };
  }

  const parsed = bulkListingUpdateSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { listingIds, targetStatus } = parsed.data;

  await db
    .update(listing)
    .set({ status: targetStatus, updatedAt: new Date() })
    .where(inArray(listing.id, listingIds));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'BULK_LISTING_STATUS_UPDATE',
    subject: 'Listing',
    subjectId: null,
    severity: 'HIGH',
    detailsJson: { listingIds, targetStatus, count: listingIds.length },
  });

  revalidatePath('/bulk');
  return { success: true };
}

// ─── Bulk User Ban ─────────────────────────────────────────────────────────────

export async function bulkBanUsersAction(input: unknown): Promise<ActionResult> {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'User')) {
    return { error: 'Forbidden' };
  }

  const parsed = bulkUserBanSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { userIds, reason } = parsed.data;

  // Filter out the acting staff member from the target list
  const targetIds = userIds.filter((id) => id !== session.staffUserId);
  if (targetIds.length === 0) return { error: 'No valid users to ban' };

  await db
    .update(user)
    .set({ isBanned: true, bannedAt: new Date(), bannedReason: reason, updatedAt: new Date() })
    .where(
      inArray(user.id, targetIds)
    );

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'BULK_BAN_USERS',
    subject: 'User',
    subjectId: null,
    severity: 'HIGH',
    detailsJson: { userIds: targetIds, reason, count: targetIds.length },
  });

  revalidatePath('/bulk');
  return { success: true };
}

// ─── Bulk User Unban ───────────────────────────────────────────────────────────

export async function bulkUnbanUsersAction(input: unknown): Promise<ActionResult> {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'User')) {
    return { error: 'Forbidden' };
  }

  const parsed = bulkUserUnbanSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { userIds } = parsed.data;

  await db
    .update(user)
    .set({ isBanned: false, bannedAt: null, bannedReason: null, updatedAt: new Date() })
    .where(
      inArray(user.id, userIds)
    );

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'BULK_UNBAN_USERS',
    subject: 'User',
    subjectId: null,
    severity: 'HIGH',
    detailsJson: { userIds, count: userIds.length },
  });

  revalidatePath('/bulk');
  return { success: true };
}
