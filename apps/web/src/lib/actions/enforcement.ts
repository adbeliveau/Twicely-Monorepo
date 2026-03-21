'use server';

/**
 * Enforcement Actions (G4)
 * Staff actions: review content reports, issue/lift enforcement actions, set band overrides.
 */

import { db } from '@twicely/db';
import {
  contentReport, enforcementAction, sellerProfile, auditEvent, listing,
} from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import {
  reviewContentReportSchema,
  issueEnforcementActionSchema,
  liftEnforcementActionSchema,
  updateSellerEnforcementSchema,
} from '@/lib/validations/enforcement';

export async function reviewContentReportAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'ContentReport')) return { error: 'Forbidden' };

  const parsed = reviewContentReportSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { reportId, status, reviewNotes } = parsed.data;

  const [existing] = await db
    .select({ id: contentReport.id })
    .from(contentReport)
    .where(eq(contentReport.id, reportId))
    .limit(1);
  if (!existing) return { error: 'Report not found' };

  await db
    .update(contentReport)
    .set({
      status,
      reviewedByStaffId: session.staffUserId,
      reviewedAt: new Date(),
      reviewNotes: reviewNotes ?? null,
      updatedAt: new Date(),
    })
    .where(eq(contentReport.id, reportId));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'CONTENT_REPORT_REVIEWED',
    subject: 'ContentReport',
    subjectId: reportId,
    severity: 'HIGH',
    detailsJson: { status, reviewNotes: reviewNotes ?? '' },
  });

  revalidatePath('/mod/reports');
  return { success: true };
}

export async function issueEnforcementActionAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('create', 'EnforcementAction')) return { error: 'Forbidden' };

  const parsed = issueEnforcementActionSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { userId, actionType, trigger, reason, contentReportId, expiresAt } = parsed.data;

  const [newAction] = await db.insert(enforcementAction).values({
    userId,
    actionType,
    trigger,
    status: 'ACTIVE',
    reason,
    details: {},
    contentReportId: contentReportId ?? null,
    issuedByStaffId: session.staffUserId,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
  }).returning({ id: enforcementAction.id });

  // Apply listing-level side effects via linked content report
  if (actionType === 'LISTING_REMOVAL' || actionType === 'LISTING_SUPPRESSION') {
    const targetState = actionType === 'LISTING_REMOVAL' ? 'REMOVED' : 'SUPPRESSED';
    if (contentReportId) {
      const [report] = await db.select({ targetType: contentReport.targetType, targetId: contentReport.targetId })
        .from(contentReport).where(eq(contentReport.id, contentReportId)).limit(1);
      if (report?.targetType === 'LISTING') {
        await db.update(listing).set({ enforcementState: targetState, updatedAt: new Date() })
          .where(eq(listing.id, report.targetId));
      }
    }
  }

  if (actionType === 'SUSPENSION') {
    await db
      .update(sellerProfile)
      .set({ status: 'SUSPENDED', updatedAt: new Date() })
      .where(eq(sellerProfile.userId, userId));
  }

  if (actionType === 'RESTRICTION') {
    await db
      .update(sellerProfile)
      .set({ status: 'RESTRICTED', updatedAt: new Date() })
      .where(eq(sellerProfile.userId, userId));
  }

  if (
    actionType === 'WARNING' ||
    actionType === 'COACHING' ||
    actionType === 'RESTRICTION' ||
    actionType === 'PRE_SUSPENSION'
  ) {
    await db
      .update(sellerProfile)
      .set({
        enforcementLevel: actionType,
        enforcementStartedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(sellerProfile.userId, userId));
  }

  const severity = actionType === 'SUSPENSION' || actionType === 'ACCOUNT_BAN'
    ? 'CRITICAL'
    : 'HIGH';

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'ENFORCEMENT_ACTION_ISSUED',
    subject: 'EnforcementAction',
    subjectId: newAction?.id ?? userId,
    severity,
    detailsJson: { userId, actionType, trigger, reason },
  });

  revalidatePath('/mod');
  return { success: true };
}

export async function liftEnforcementActionAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'EnforcementAction')) return { error: 'Forbidden' };

  const parsed = liftEnforcementActionSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { actionId, liftedReason } = parsed.data;

  const [existing] = await db
    .select({
      id: enforcementAction.id,
      userId: enforcementAction.userId,
      actionType: enforcementAction.actionType,
      status: enforcementAction.status,
      contentReportId: enforcementAction.contentReportId,
    })
    .from(enforcementAction)
    .where(eq(enforcementAction.id, actionId))
    .limit(1);

  if (!existing) return { error: 'Enforcement action not found' };
  if (existing.status === 'LIFTED') return { error: 'Action is already lifted' };

  await db
    .update(enforcementAction)
    .set({
      status: 'LIFTED',
      liftedAt: new Date(),
      liftedByStaffId: session.staffUserId,
      liftedReason,
      updatedAt: new Date(),
    })
    .where(eq(enforcementAction.id, actionId));

  // Reverse side effects
  if (existing.actionType === 'SUSPENSION' || existing.actionType === 'RESTRICTION') {
    await db
      .update(sellerProfile)
      .set({ status: 'ACTIVE', updatedAt: new Date() })
      .where(eq(sellerProfile.userId, existing.userId));
  }

  if (
    existing.actionType === 'WARNING' ||
    existing.actionType === 'COACHING' ||
    existing.actionType === 'RESTRICTION' ||
    existing.actionType === 'PRE_SUSPENSION'
  ) {
    await db
      .update(sellerProfile)
      .set({
        enforcementLevel: null,
        enforcementStartedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(sellerProfile.userId, existing.userId));
  }

  if (existing.actionType === 'LISTING_REMOVAL' || existing.actionType === 'LISTING_SUPPRESSION') {
    const [linkedReport] = await db.select({ targetType: contentReport.targetType, targetId: contentReport.targetId })
      .from(contentReport).where(eq(contentReport.id, existing.contentReportId ?? '')).limit(1);
    if (linkedReport?.targetType === 'LISTING') {
      await db.update(listing).set({ enforcementState: 'CLEAR', updatedAt: new Date() })
        .where(eq(listing.id, linkedReport.targetId));
    }
  }

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'ENFORCEMENT_ACTION_LIFTED',
    subject: 'EnforcementAction',
    subjectId: actionId,
    severity: 'HIGH',
    detailsJson: { liftedReason, userId: existing.userId, actionType: existing.actionType },
  });

  revalidatePath('/mod');
  return { success: true };
}

export async function updateSellerBandOverrideAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'SellerProfile')) return { error: 'Forbidden' };

  const parsed = updateSellerEnforcementSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { userId, enforcementLevel, bandOverride, bandOverrideReason } = parsed.data;

  await db
    .update(sellerProfile)
    .set({
      bandOverride: bandOverride ?? null,
      bandOverrideReason: bandOverrideReason ?? null,
      bandOverrideBy: session.staffUserId,
      bandOverrideExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(sellerProfile.userId, userId));

  if (enforcementLevel !== undefined) {
    await db
      .update(sellerProfile)
      .set({
        enforcementLevel: enforcementLevel ?? null,
        enforcementStartedAt: enforcementLevel ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(sellerProfile.userId, userId));
  }

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'BAND_OVERRIDE_SET',
    subject: 'SellerProfile',
    subjectId: userId,
    severity: 'HIGH',
    detailsJson: { userId, bandOverride: bandOverride ?? null, bandOverrideReason: bandOverrideReason ?? '' },
  });

  revalidatePath('/mod');
  return { success: true };
}
