'use server';

/**
 * Enforcement Appeal Actions (G4.2)
 * Seller action: submit an appeal on an active enforcement action.
 * Staff action: approve or deny a pending appeal.
 */

import { db } from '@twicely/db';
import { enforcementAction, sellerProfile, listing, contentReport, auditEvent } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { authorize, sub } from '@twicely/casl';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { submitAppealSchema, reviewAppealSchema } from '@/lib/validations/enforcement';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { notify } from '@twicely/notifications/service';

// ─── submitEnforcementAppealAction ────────────────────────────────────────────

export async function submitEnforcementAppealAction(input: unknown) {
  const { ability, session } = await authorize();
  if (!session) return { error: 'Unauthenticated' };
  if (!ability.can('update', sub('EnforcementAction', { userId: session.userId }))) {
    return { error: 'Forbidden' };
  }

  const parsed = submitAppealSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { enforcementActionId, appealNote, appealEvidenceUrls } = parsed.data;

  const [existing] = await db
    .select({
      id: enforcementAction.id,
      userId: enforcementAction.userId,
      actionType: enforcementAction.actionType,
      status: enforcementAction.status,
      appealedAt: enforcementAction.appealedAt,
      createdAt: enforcementAction.createdAt,
    })
    .from(enforcementAction)
    .where(eq(enforcementAction.id, enforcementActionId))
    .limit(1);

  if (!existing) return { error: 'Not found' };
  if (existing.userId !== session.userId) return { error: 'Not found' };
  if (existing.status !== 'ACTIVE') return { error: 'Only active enforcement actions can be appealed' };

  const [appealWindowDays, , appealableTypes] = await Promise.all([
    getPlatformSetting<number>('score.enforcement.appealWindowDays', 30),
    getPlatformSetting<number>('score.enforcement.maxAppealsPerAction', 1),
    getPlatformSetting<string[]>('score.enforcement.appealableActionTypes', [
      'WARNING', 'RESTRICTION', 'PRE_SUSPENSION', 'SUSPENSION',
      'LISTING_REMOVAL', 'LISTING_SUPPRESSION', 'BOOST_DISABLED', 'LISTING_CAP', 'SEARCH_DEMOTION',
    ]),
  ]);

  const windowMs = Number(appealWindowDays) * 24 * 60 * 60 * 1000;
  if (Date.now() - existing.createdAt.getTime() > windowMs) {
    return { error: 'Appeal window has expired' };
  }

  if (existing.appealedAt !== null) {
    return { error: 'This action has already been appealed' };
  }

  const typesSet = new Set(appealableTypes as string[]);
  if (!typesSet.has(existing.actionType)) {
    return { error: 'This action type cannot be appealed' };
  }

  await db
    .update(enforcementAction)
    .set({
      status: 'APPEALED',
      appealNote,
      appealEvidenceUrls: appealEvidenceUrls ?? [],
      appealedAt: new Date(),
      appealedByUserId: session.userId,
      updatedAt: new Date(),
    })
    .where(eq(enforcementAction.id, enforcementActionId));

  await db.insert(auditEvent).values({
    actorType: 'USER',
    actorId: session.userId,
    action: 'ENFORCEMENT_APPEAL_SUBMITTED',
    subject: 'EnforcementAction',
    subjectId: enforcementActionId,
    severity: 'HIGH',
    detailsJson: { userId: session.userId, actionType: existing.actionType, appealNote },
  });

  void notify(session.userId, 'enforcement.appeal_submitted', { actionType: existing.actionType });
  revalidatePath('/my/selling/performance');
  revalidatePath('/mod/enforcement');
  return { success: true };
}

// ─── reviewEnforcementAppealAction ────────────────────────────────────────────

export async function reviewEnforcementAppealAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'EnforcementAction')) return { error: 'Forbidden' };

  const parsed = reviewAppealSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { enforcementActionId, decision, reviewNote } = parsed.data;

  const [existing] = await db
    .select({
      id: enforcementAction.id,
      userId: enforcementAction.userId,
      actionType: enforcementAction.actionType,
      status: enforcementAction.status,
      contentReportId: enforcementAction.contentReportId,
    })
    .from(enforcementAction)
    .where(eq(enforcementAction.id, enforcementActionId))
    .limit(1);

  if (!existing) return { error: 'Not found' };
  if (existing.status !== 'APPEALED') return { error: 'Only appealed actions can be reviewed' };

  if (decision === 'APPROVED') {
    await db
      .update(enforcementAction)
      .set({
        status: 'APPEAL_APPROVED',
        appealReviewedByStaffId: session.staffUserId,
        appealReviewNote: reviewNote,
        appealResolvedAt: new Date(),
        liftedAt: new Date(),
        liftedByStaffId: session.staffUserId,
        liftedReason: 'Appeal approved: ' + reviewNote,
        updatedAt: new Date(),
      })
      .where(eq(enforcementAction.id, enforcementActionId));

    // Reverse side effects (mirrors liftEnforcementActionAction)
    if (existing.actionType === 'SUSPENSION' || existing.actionType === 'RESTRICTION') {
      await db
        .update(sellerProfile)
        .set({ status: 'ACTIVE', updatedAt: new Date() })
        .where(eq(sellerProfile.userId, existing.userId));
    }

    if (
      existing.actionType === 'WARNING' ||
      existing.actionType === 'RESTRICTION' ||
      existing.actionType === 'PRE_SUSPENSION'
    ) {
      await db
        .update(sellerProfile)
        .set({ enforcementLevel: null, enforcementStartedAt: null, updatedAt: new Date() })
        .where(eq(sellerProfile.userId, existing.userId));
    }

    if (existing.actionType === 'LISTING_REMOVAL' || existing.actionType === 'LISTING_SUPPRESSION') {
      const [linkedReport] = await db
        .select({ targetType: contentReport.targetType, targetId: contentReport.targetId })
        .from(contentReport)
        .where(eq(contentReport.id, existing.contentReportId ?? ''))
        .limit(1);
      if (linkedReport?.targetType === 'LISTING') {
        await db
          .update(listing)
          .set({ enforcementState: 'CLEAR', updatedAt: new Date() })
          .where(eq(listing.id, linkedReport.targetId));
      }
    }

    void notify(existing.userId, 'enforcement.appeal_approved', {
      actionType: existing.actionType,
    });
  } else {
    // DENIED — action returns to ACTIVE
    await db
      .update(enforcementAction)
      .set({
        status: 'ACTIVE',
        appealReviewedByStaffId: session.staffUserId,
        appealReviewNote: reviewNote,
        appealResolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(enforcementAction.id, enforcementActionId));

    void notify(existing.userId, 'enforcement.appeal_denied', {
      actionType: existing.actionType,
    });
  }

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'ENFORCEMENT_APPEAL_REVIEWED',
    subject: 'EnforcementAction',
    subjectId: enforcementActionId,
    severity: 'HIGH',
    detailsJson: { decision, reviewNote, userId: existing.userId },
  });

  revalidatePath('/mod/enforcement');
  revalidatePath(`/mod/enforcement/${enforcementActionId}`);
  return { success: true };
}
