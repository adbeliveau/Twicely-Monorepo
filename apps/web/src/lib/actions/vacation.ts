'use server';

import { revalidatePath } from 'next/cache';
import { authorize, sub } from '@twicely/casl';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { db } from '@twicely/db';
import {
  sellerProfile,
  storefront,
  listing,
  auditEvent,
} from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { getUnfulfilledOrderCount } from '@/lib/queries/vacation';
import { declineAllPendingOffersForListing } from '@twicely/commerce/offer-transitions';
import {
  activateVacationSchema,
  adminForceDeactivateVacationSchema,
  type ActivateVacationInput,
  type AdminForceDeactivateVacationInput,
} from '@/lib/validations/vacation';
import { createId } from '@paralleldrive/cuid2';

interface ActionResult {
  success: boolean;
  error?: string;
  unfulfilledOrderCount?: number;
  offersDeclined?: number;
}

// ─── activateVacation ──────────────────────────────────────────────────────────

export async function activateVacation(data: ActivateVacationInput): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Please sign in' };

  if (!ability.can('update', sub('SellerProfile', { userId: session.userId }))) {
    return { success: false, error: 'Not authorized' };
  }

  const parsed = activateVacationSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { modeType, vacationMessage, autoReplyMessage, startAt, endAt } = parsed.data;

  // Load max duration settings from platform_settings
  const [maxPauseDays, maxAllowSalesDays] = await Promise.all([
    getPlatformSetting<number>('vacation.maxPauseDays', 30),
    getPlatformSetting<number>('vacation.maxAllowSalesDays', 15),
  ]);

  const now = new Date();
  const effectiveStart = startAt ? new Date(startAt) : now;
  const end = new Date(endAt);

  if (end <= now) {
    return { success: false, error: 'End date must be in the future' };
  }
  if (effectiveStart >= end) {
    return { success: false, error: 'Start date must be before end date' };
  }

  const durationDays = (end.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24);
  const maxDays = modeType === 'ALLOW_SALES' ? maxAllowSalesDays : maxPauseDays;
  if (durationDays > maxDays) {
    return { success: false, error: `Duration cannot exceed ${maxDays} days for ${modeType} mode` };
  }

  // Check unfulfilled orders — warn but do NOT block
  const unfulfilledOrderCount = await getUnfulfilledOrderCount(session.userId);

  // Update sellerProfile
  await db
    .update(sellerProfile)
    .set({
      vacationMode: true,
      vacationModeType: modeType,
      vacationMessage: vacationMessage ?? null,
      vacationAutoReplyMessage: autoReplyMessage ?? null,
      vacationStartAt: effectiveStart,
      vacationEndAt: end,
      updatedAt: now,
    })
    .where(eq(sellerProfile.userId, session.userId));

  // Sync storefront mirror
  await db
    .update(storefront)
    .set({
      vacationMode: true,
      vacationMessage: vacationMessage ?? null,
      updatedAt: now,
    })
    .where(eq(storefront.ownerUserId, session.userId));

  // Auto-decline pending offers if setting is enabled
  const autoDecline = await getPlatformSetting<boolean>('vacation.autoDeclinePendingOffers', true);
  let offersDeclined = 0;

  if (autoDecline) {
    const activeListings = await db
      .select({ id: listing.id })
      .from(listing)
      .where(
        and(
          eq(listing.ownerUserId, session.userId),
          eq(listing.status, 'ACTIVE'),
        ),
      );

    for (const lst of activeListings) {
      const result = await declineAllPendingOffersForListing(lst.id);
      offersDeclined += result.declined;
    }
  }

  // Revalidate paths
  revalidatePath('/my/selling/store');

  const [sp] = await db
    .select({ storeSlug: sellerProfile.storeSlug })
    .from(sellerProfile)
    .where(eq(sellerProfile.userId, session.userId))
    .limit(1);

  if (sp?.storeSlug) {
    revalidatePath(`/st/${sp.storeSlug}`);
  }

  return { success: true, unfulfilledOrderCount, offersDeclined };
}

// ─── deactivateVacation ────────────────────────────────────────────────────────

export async function deactivateVacation(): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Please sign in' };

  if (!ability.can('update', sub('SellerProfile', { userId: session.userId }))) {
    return { success: false, error: 'Not authorized' };
  }

  const [sp] = await db
    .select({ vacationMode: sellerProfile.vacationMode, storeSlug: sellerProfile.storeSlug })
    .from(sellerProfile)
    .where(eq(sellerProfile.userId, session.userId))
    .limit(1);

  if (!sp) return { success: false, error: 'Not found' };
  if (!sp.vacationMode) return { success: false, error: 'Not currently on vacation' };

  const now = new Date();

  await db
    .update(sellerProfile)
    .set({
      vacationMode: false,
      vacationModeType: null,
      vacationMessage: null,
      vacationAutoReplyMessage: null,
      vacationStartAt: null,
      vacationEndAt: null,
      updatedAt: now,
    })
    .where(eq(sellerProfile.userId, session.userId));

  await db
    .update(storefront)
    .set({
      vacationMode: false,
      vacationMessage: null,
      updatedAt: now,
    })
    .where(eq(storefront.ownerUserId, session.userId));

  revalidatePath('/my/selling/store');
  if (sp.storeSlug) {
    revalidatePath(`/st/${sp.storeSlug}`);
  }

  return { success: true };
}

// ─── adminForceDeactivateVacation ─────────────────────────────────────────────

export async function adminForceDeactivateVacation(
  data: AdminForceDeactivateVacationInput,
): Promise<ActionResult> {
  const { ability, session: staffSession } = await staffAuthorize();

  if (!ability.can('manage', 'SellerProfile')) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = adminForceDeactivateVacationSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { sellerId, reason } = parsed.data;

  const [sp] = await db
    .select({ vacationMode: sellerProfile.vacationMode })
    .from(sellerProfile)
    .where(eq(sellerProfile.userId, sellerId))
    .limit(1);

  if (!sp) return { success: false, error: 'Seller not found' };
  if (!sp.vacationMode) return { success: false, error: 'Seller is not on vacation' };

  const now = new Date();

  await db
    .update(sellerProfile)
    .set({
      vacationMode: false,
      vacationModeType: null,
      vacationMessage: null,
      vacationAutoReplyMessage: null,
      vacationStartAt: null,
      vacationEndAt: null,
      updatedAt: now,
    })
    .where(eq(sellerProfile.userId, sellerId));

  await db
    .update(storefront)
    .set({
      vacationMode: false,
      vacationMessage: null,
      updatedAt: now,
    })
    .where(eq(storefront.ownerUserId, sellerId));

  await db.insert(auditEvent).values({
    id: createId(),
    actorType: 'STAFF',
    actorId: staffSession.staffUserId,
    action: 'admin.vacation.forceDeactivate',
    subject: 'SellerProfile',
    subjectId: sellerId,
    severity: 'MEDIUM',
    detailsJson: { reason },
  });

  return { success: true };
}

