'use server';

/**
 * Admin Moderation Actions (E3.5 + I5 + I6)
 * Remove/clear/suppress listings, approve/remove/flag reviews — all audited
 */

import { db } from '@twicely/db';
import { listing, review, contentReport, auditEvent } from '@twicely/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const listingActionSchema = z.object({
  listingId: z.string().min(1),
  reason: z.string().min(1).max(500).optional(),
}).strict();

const reviewActionSchema = z.object({
  reviewId: z.string().min(1),
  reason: z.string().min(1).max(500).optional(),
}).strict();

const bulkListingSchema = z.object({
  listingIds: z.array(z.string().min(1)).min(1).max(50),
  reason: z.string().min(1).max(500).optional(),
}).strict();

const bulkReportSchema = z.object({
  reportIds: z.array(z.string().min(1)).min(1).max(50),
  reason: z.string().min(1).max(500).optional(),
}).strict();

const bulkReviewSchema = z.object({
  reviewIds: z.array(z.string().min(1)).min(1).max(50),
  reason: z.string().min(1).max(500).optional(),
}).strict();

// ─── Listing Actions ──────────────────────────────────────────────────────────

export async function removeListingAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'Listing')) {
    return { error: 'Forbidden' };
  }

  const parsed = listingActionSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  await db
    .update(listing)
    .set({ enforcementState: 'REMOVED' })
    .where(eq(listing.id, parsed.data.listingId));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'REMOVE_LISTING',
    subject: 'Listing',
    subjectId: parsed.data.listingId,
    severity: 'HIGH',
    detailsJson: { reason: parsed.data.reason ?? '' },
  });

  revalidatePath('/mod');
  return { success: true };
}

export async function clearListingFlagAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'Listing')) {
    return { error: 'Forbidden' };
  }

  const parsed = listingActionSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  await db
    .update(listing)
    .set({ enforcementState: 'CLEAR' })
    .where(eq(listing.id, parsed.data.listingId));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'CLEAR_LISTING_FLAG',
    subject: 'Listing',
    subjectId: parsed.data.listingId,
    severity: 'MEDIUM',
    detailsJson: {},
  });

  revalidatePath('/mod');
  return { success: true };
}

export async function suppressListingAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'Listing')) {
    return { error: 'Forbidden' };
  }

  const parsed = listingActionSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  await db
    .update(listing)
    .set({ enforcementState: 'SUPPRESSED' })
    .where(eq(listing.id, parsed.data.listingId));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'SUPPRESS_LISTING',
    subject: 'Listing',
    subjectId: parsed.data.listingId,
    severity: 'HIGH',
    detailsJson: { reason: parsed.data.reason ?? '' },
  });

  revalidatePath('/mod');
  return { success: true };
}

export async function reinstateListingAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'Listing')) {
    return { error: 'Forbidden' };
  }

  const parsed = listingActionSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  await db
    .update(listing)
    .set({ enforcementState: 'CLEAR' })
    .where(eq(listing.id, parsed.data.listingId));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'REINSTATE_LISTING',
    subject: 'Listing',
    subjectId: parsed.data.listingId,
    severity: 'MEDIUM',
    detailsJson: { reason: parsed.data.reason ?? '' },
  });

  revalidatePath('/mod');
  return { success: true };
}

export async function flagListingAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'Listing')) {
    return { error: 'Forbidden' };
  }

  const parsed = listingActionSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  await db
    .update(listing)
    .set({ enforcementState: 'FLAGGED' })
    .where(eq(listing.id, parsed.data.listingId));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'FLAG_LISTING',
    subject: 'Listing',
    subjectId: parsed.data.listingId,
    severity: 'MEDIUM',
    detailsJson: { reason: parsed.data.reason ?? '' },
  });

  revalidatePath('/mod');
  return { success: true };
}

export async function bulkClearListingFlagsAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'Listing')) {
    return { error: 'Forbidden' };
  }

  const parsed = bulkListingSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  if (parsed.data.listingIds.length === 0) return { error: 'No listings specified' };

  await db
    .update(listing)
    .set({ enforcementState: 'CLEAR' })
    .where(inArray(listing.id, parsed.data.listingIds));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'BULK_CLEAR_LISTING_FLAGS',
    subject: 'Listing',
    subjectId: 'bulk',
    severity: 'HIGH',
    detailsJson: { ids: parsed.data.listingIds, reason: parsed.data.reason ?? '' },
  });

  revalidatePath('/mod');
  return { success: true };
}

export async function bulkDismissReportsAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'ContentReport')) {
    return { error: 'Forbidden' };
  }

  const parsed = bulkReportSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  if (parsed.data.reportIds.length === 0) return { error: 'No reports specified' };

  await db
    .update(contentReport)
    .set({ status: 'DISMISSED', reviewedAt: new Date(), reviewedByStaffId: session.staffUserId })
    .where(inArray(contentReport.id, parsed.data.reportIds));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'BULK_DISMISS_REPORTS',
    subject: 'ContentReport',
    subjectId: 'bulk',
    severity: 'HIGH',
    detailsJson: { ids: parsed.data.reportIds, reason: parsed.data.reason ?? '' },
  });

  revalidatePath('/mod');
  return { success: true };
}

// ─── Review Actions ───────────────────────────────────────────────────────────

export async function removeReviewAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'Review')) {
    return { error: 'Forbidden' };
  }

  const parsed = reviewActionSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  await db
    .update(review)
    .set({
      status: 'REMOVED',
      removedByStaffId: session.staffUserId,
      removedReason: parsed.data.reason ?? null,
    })
    .where(eq(review.id, parsed.data.reviewId));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'REMOVE_REVIEW',
    subject: 'Review',
    subjectId: parsed.data.reviewId,
    severity: 'HIGH',
    detailsJson: { reason: parsed.data.reason ?? '' },
  });

  revalidatePath('/mod');
  return { success: true };
}

export async function approveReviewAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'Review')) {
    return { error: 'Forbidden' };
  }

  const parsed = reviewActionSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  await db
    .update(review)
    .set({ status: 'APPROVED' })
    .where(eq(review.id, parsed.data.reviewId));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'APPROVE_REVIEW',
    subject: 'Review',
    subjectId: parsed.data.reviewId,
    severity: 'MEDIUM',
    detailsJson: {},
  });

  revalidatePath('/mod');
  return { success: true };
}

export async function flagReviewAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'Review')) {
    return { error: 'Forbidden' };
  }

  const parsed = reviewActionSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  await db
    .update(review)
    .set({ status: 'FLAGGED' })
    .where(eq(review.id, parsed.data.reviewId));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'FLAG_REVIEW',
    subject: 'Review',
    subjectId: parsed.data.reviewId,
    severity: 'MEDIUM',
    detailsJson: { reason: parsed.data.reason ?? '' },
  });

  revalidatePath('/mod');
  return { success: true };
}

export async function bulkApproveReviewsAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'Review')) {
    return { error: 'Forbidden' };
  }

  const parsed = bulkReviewSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  if (parsed.data.reviewIds.length === 0) return { error: 'No reviews specified' };

  await db
    .update(review)
    .set({ status: 'APPROVED' })
    .where(inArray(review.id, parsed.data.reviewIds));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'BULK_APPROVE_REVIEWS',
    subject: 'Review',
    subjectId: 'bulk',
    severity: 'MEDIUM',
    detailsJson: { ids: parsed.data.reviewIds },
  });

  revalidatePath('/mod');
  return { success: true };
}

export async function bulkRemoveReviewsAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'Review')) {
    return { error: 'Forbidden' };
  }

  const parsed = bulkReviewSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  if (parsed.data.reviewIds.length === 0) return { error: 'No reviews specified' };

  await db
    .update(review)
    .set({
      status: 'REMOVED',
      removedByStaffId: session.staffUserId,
      removedReason: parsed.data.reason ?? null,
    })
    .where(inArray(review.id, parsed.data.reviewIds));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'BULK_REMOVE_REVIEWS',
    subject: 'Review',
    subjectId: 'bulk',
    severity: 'HIGH',
    detailsJson: { ids: parsed.data.reviewIds, reason: parsed.data.reason ?? '' },
  });

  revalidatePath('/mod');
  return { success: true };
}
