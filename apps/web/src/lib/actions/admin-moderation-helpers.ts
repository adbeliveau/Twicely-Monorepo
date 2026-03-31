'use server';

/**
 * Admin Moderation Helpers — Review actions and bulk operations.
 * Split from admin-moderation.ts to stay under 300 lines.
 */

import { db } from '@twicely/db';
import { review, contentReport, auditEvent } from '@twicely/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { zodId } from '@/lib/validations/shared';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const reviewActionSchema = z.object({
  reviewId: zodId,
  reason: z.string().min(1).max(500).optional(),
}).strict();

const bulkReportSchema = z.object({
  reportIds: z.array(zodId).min(1).max(50),
  reason: z.string().min(1).max(500).optional(),
}).strict();

const bulkReviewSchema = z.object({
  reviewIds: z.array(zodId).min(1).max(50),
  reason: z.string().min(1).max(500).optional(),
}).strict();

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

// ─── Bulk Operations ──────────────────────────────────────────────────────────

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
