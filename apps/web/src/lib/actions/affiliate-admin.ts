'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@twicely/db';
import { affiliate, promoCode, auditEvent } from '@twicely/db/schema';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import {
  approveInfluencerSchema,
  rejectInfluencerSchema,
  suspendAffiliateSchema,
  unsuspendAffiliateSchema,
  banAffiliateSchema,
} from '@/lib/validations/affiliate';

interface AdminActionResult {
  success: boolean;
  error?: string;
}

async function getAffiliateById(affiliateId: string) {
  const [row] = await db
    .select()
    .from(affiliate)
    .where(eq(affiliate.id, affiliateId))
    .limit(1);
  return row ?? null;
}

// ─── Action 1: approveInfluencerApplication ──────────────────────────────────

export async function approveInfluencerApplication(input: unknown): Promise<AdminActionResult> {
  const { ability, session } = await staffAuthorize();

  if (!ability.can('manage', 'Affiliate')) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = approveInfluencerSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const data = parsed.data;
  const record = await getAffiliateById(data.affiliateId);

  if (!record) {
    return { success: false, error: 'Affiliate record not found' };
  }

  if (record.status !== 'PENDING' || record.tier !== 'INFLUENCER') {
    return { success: false, error: 'This application is not pending influencer review' };
  }

  await db
    .update(affiliate)
    .set({
      status: 'ACTIVE',
      commissionRateBps: data.commissionRateBps,
      cookieDurationDays: data.cookieDurationDays,
      commissionDurationMonths: data.commissionDurationMonths,
      updatedAt: new Date(),
    })
    .where(eq(affiliate.id, data.affiliateId));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'INFLUENCER_APPROVED',
    subject: 'Affiliate',
    subjectId: data.affiliateId,
    severity: 'MEDIUM',
    detailsJson: {
      commissionRateBps: data.commissionRateBps,
      cookieDurationDays: data.cookieDurationDays,
      commissionDurationMonths: data.commissionDurationMonths,
      adminNote: data.adminNote ?? null,
    },
  });

  revalidatePath('/usr/affiliates');
  return { success: true };
}

// ─── Action 2: rejectInfluencerApplication ───────────────────────────────────

export async function rejectInfluencerApplication(input: unknown): Promise<AdminActionResult> {
  const { ability, session } = await staffAuthorize();

  if (!ability.can('manage', 'Affiliate')) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = rejectInfluencerSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const data = parsed.data;
  const record = await getAffiliateById(data.affiliateId);

  if (!record) {
    return { success: false, error: 'Affiliate record not found' };
  }

  if (record.status !== 'PENDING' || record.tier !== 'INFLUENCER') {
    return { success: false, error: 'This application is not pending influencer review' };
  }

  const updatedNote = record.applicationNote
    ? `${record.applicationNote}\n\n[REJECTED] ${data.rejectionReason}`
    : `[REJECTED] ${data.rejectionReason}`;

  await db
    .update(affiliate)
    .set({
      tier: 'COMMUNITY',
      status: 'ACTIVE',
      applicationNote: updatedNote,
      updatedAt: new Date(),
    })
    .where(eq(affiliate.id, data.affiliateId));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'INFLUENCER_REJECTED',
    subject: 'Affiliate',
    subjectId: data.affiliateId,
    severity: 'MEDIUM',
    detailsJson: { rejectionReason: data.rejectionReason },
  });

  revalidatePath('/usr/affiliates');
  return { success: true };
}

// ─── Action 3: suspendAffiliate ──────────────────────────────────────────────

export async function suspendAffiliate(input: unknown): Promise<AdminActionResult> {
  const { ability, session } = await staffAuthorize();

  if (!ability.can('manage', 'Affiliate')) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = suspendAffiliateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const data = parsed.data;
  const record = await getAffiliateById(data.affiliateId);

  if (!record) {
    return { success: false, error: 'Affiliate record not found' };
  }

  if (record.status === 'BANNED' || record.status === 'SUSPENDED') {
    return { success: false, error: 'Affiliate is already suspended or banned' };
  }

  await db
    .update(affiliate)
    .set({
      status: 'SUSPENDED',
      suspendedAt: new Date(),
      suspendedReason: data.reason,
      warningCount: record.warningCount + 1,
      updatedAt: new Date(),
    })
    .where(eq(affiliate.id, data.affiliateId));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'AFFILIATE_SUSPENDED',
    subject: 'Affiliate',
    subjectId: data.affiliateId,
    severity: 'HIGH',
    detailsJson: { reason: data.reason, warningCount: record.warningCount + 1 },
  });

  revalidatePath('/usr/affiliates');
  return { success: true };
}

// ─── Action 4: unsuspendAffiliate ────────────────────────────────────────────

export async function unsuspendAffiliate(input: unknown): Promise<AdminActionResult> {
  const { ability, session } = await staffAuthorize();

  if (!ability.can('manage', 'Affiliate')) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = unsuspendAffiliateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const data = parsed.data;
  const record = await getAffiliateById(data.affiliateId);

  if (!record) {
    return { success: false, error: 'Affiliate record not found' };
  }

  if (record.status !== 'SUSPENDED') {
    return { success: false, error: 'Affiliate is not currently suspended' };
  }

  await db
    .update(affiliate)
    .set({
      status: 'ACTIVE',
      suspendedAt: null,
      suspendedReason: null,
      updatedAt: new Date(),
    })
    .where(eq(affiliate.id, data.affiliateId));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'AFFILIATE_UNSUSPENDED',
    subject: 'Affiliate',
    subjectId: data.affiliateId,
    severity: 'MEDIUM',
    detailsJson: {},
  });

  revalidatePath('/usr/affiliates');
  return { success: true };
}

// ─── Action 5: banAffiliate ──────────────────────────────────────────────────

export async function banAffiliate(input: unknown): Promise<AdminActionResult> {
  const { ability, session } = await staffAuthorize();

  if (!ability.can('manage', 'Affiliate')) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = banAffiliateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const data = parsed.data;
  const record = await getAffiliateById(data.affiliateId);

  if (!record) {
    return { success: false, error: 'Affiliate record not found' };
  }

  if (record.status === 'BANNED') {
    return { success: false, error: 'Affiliate is already banned' };
  }

  await db
    .update(affiliate)
    .set({
      status: 'BANNED',
      suspendedAt: new Date(),
      suspendedReason: data.reason,
      updatedAt: new Date(),
    })
    .where(eq(affiliate.id, data.affiliateId));

  // Deactivate all of this affiliate's promo codes
  await db
    .update(promoCode)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(promoCode.affiliateId, data.affiliateId));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'AFFILIATE_BANNED',
    subject: 'Affiliate',
    subjectId: data.affiliateId,
    severity: 'CRITICAL',
    detailsJson: { reason: data.reason },
  });

  revalidatePath('/usr/affiliates');
  return { success: true };
}
