'use server';

import { revalidatePath } from 'next/cache';
import { eq, and, count } from 'drizzle-orm';
import { db } from '@twicely/db';
import { promoCode, auditEvent } from '@twicely/db/schema';
import { authorize, sub } from '@twicely/casl';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { getAffiliateByUserId } from '@/lib/queries/affiliate';
import { getPromoCodeByCode, getPromoCodeById } from '@/lib/queries/promo-codes';
import { createPromoCodeSchema, updatePromoCodeSchema } from '@/lib/validations/promo-code';
import { syncPromoCodeToStripe } from '@twicely/stripe/promo-codes';
import { deactivateStripeIfExists } from './promo-codes-helpers';

interface ActionResult {
  success: boolean;
  error?: string;
}

// ─── Action 1: createAffiliatePromoCode ─────────────────────────────────────

export async function createAffiliatePromoCode(
  input: unknown,
): Promise<ActionResult> {
  const { ability, session } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };
  if (!session.isSeller) return { success: false, error: 'Sellers only' };

  const parsed = createPromoCodeSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const data = parsed.data;

  if (!ability.can('create', sub('PromoCode', { affiliateId: session.userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const affiliateRecord = await getAffiliateByUserId(session.userId);
  if (!affiliateRecord) return { success: false, error: 'Affiliate record not found' };
  if (affiliateRecord.status !== 'ACTIVE' && affiliateRecord.status !== 'PENDING') {
    return { success: false, error: 'Your affiliate account is not active' };
  }

  const isCommunity = affiliateRecord.tier === 'COMMUNITY';

  // Discount limits
  if (data.discountType === 'PERCENTAGE') {
    const maxBps = isCommunity
      ? await getPlatformSetting('affiliate.maxPromoDiscountBps', 2000)
      : await getPlatformSetting('affiliate.maxInfluencerDiscountBps', 5000);
    if (data.discountValue > maxBps) {
      return { success: false, error: `Discount exceeds maximum allowed (${maxBps / 100}%)` };
    }
  } else {
    const maxFixedCents = isCommunity
      ? await getPlatformSetting('affiliate.community.maxFixedPromoDiscountCents', 5000)
      : await getPlatformSetting('affiliate.influencer.maxFixedPromoDiscountCents', 10000);
    if (data.discountValue > maxFixedCents) {
      const maxDollars = maxFixedCents / 100;
      return { success: false, error: `Fixed discount exceeds maximum allowed ($${maxDollars})` };
    }
  }

  // Duration limits
  const maxDuration = isCommunity
    ? await getPlatformSetting('affiliate.community.maxPromoCodeDurationMonths', 3)
    : await getPlatformSetting('affiliate.influencer.maxPromoCodeDurationMonths', 6);
  if (data.durationMonths > maxDuration) {
    return { success: false, error: `Duration exceeds maximum allowed (${maxDuration} months)` };
  }

  // Active code limits
  const maxCodes = isCommunity
    ? await getPlatformSetting('affiliate.community.maxActivePromoCodes', 3)
    : await getPlatformSetting('affiliate.influencer.maxActivePromoCodes', 10);
  const [activeCount] = await db
    .select({ total: count() })
    .from(promoCode)
    .where(and(eq(promoCode.affiliateId, affiliateRecord.id), eq(promoCode.isActive, true)));
  if ((activeCount?.total ?? 0) >= maxCodes) {
    return { success: false, error: `Maximum active promo codes reached (${maxCodes})` };
  }

  // Code uniqueness
  const existing = await getPromoCodeByCode(data.code);
  if (existing) return { success: false, error: 'This code is already in use' };

  const [inserted] = await db
    .insert(promoCode)
    .values({
      code: data.code,
      type: 'AFFILIATE',
      affiliateId: affiliateRecord.id,
      discountType: data.discountType,
      discountValue: data.discountValue,
      durationMonths: data.durationMonths,
      scopeProductTypes: data.scopeProductTypes ?? null,
      usageLimit: data.usageLimit ?? null,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      isActive: true,
      createdByUserId: session.userId,
    })
    .returning();

  if (!inserted) return { success: false, error: 'Failed to create promo code' };

  try {
    await syncPromoCodeToStripe(inserted);
  } catch {
    // Stripe sync failure does not block creation
  }

  await db.insert(auditEvent).values({
    actorType: 'USER',
    actorId: session.userId,
    action: 'PROMO_CODE_CREATED',
    subject: 'PromoCode',
    subjectId: inserted.id,
    severity: 'LOW',
    detailsJson: { code: inserted.code, type: 'AFFILIATE', discountType: inserted.discountType },
  });

  revalidatePath('/my/selling/affiliate');
  return { success: true };
}

// ─── Action 2: updateAffiliatePromoCode ─────────────────────────────────────

export async function updateAffiliatePromoCode(
  input: unknown,
): Promise<ActionResult> {
  const { ability, session } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  if (!ability.can('update', sub('PromoCode', { affiliateId: session.userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = updatePromoCodeSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const data = parsed.data;

  const record = await getPromoCodeById(data.id);
  if (!record) return { success: false, error: 'Not found' };

  const affiliateRecord = await getAffiliateByUserId(session.userId);
  if (!affiliateRecord || record.affiliateId !== affiliateRecord.id) {
    return { success: false, error: 'Not found' };
  }

  await db
    .update(promoCode)
    .set({
      isActive: data.isActive ?? record.isActive,
      usageLimit: data.usageLimit !== undefined ? data.usageLimit : record.usageLimit,
      expiresAt: data.expiresAt !== undefined
        ? (data.expiresAt ? new Date(data.expiresAt) : null)
        : record.expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(promoCode.id, data.id));

  if (data.isActive === false) {
    await deactivateStripeIfExists(record.code);
  }

  await db.insert(auditEvent).values({
    actorType: 'USER',
    actorId: session.userId,
    action: 'PROMO_CODE_UPDATED',
    subject: 'PromoCode',
    subjectId: data.id,
    severity: 'LOW',
    detailsJson: { isActive: data.isActive },
  });

  revalidatePath('/my/selling/affiliate');
  return { success: true };
}

// ─── Action 3: deleteAffiliatePromoCode ─────────────────────────────────────

export async function deleteAffiliatePromoCode(
  id: string,
): Promise<ActionResult> {
  const { ability, session } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  if (!ability.can('delete', sub('PromoCode', { affiliateId: session.userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const record = await getPromoCodeById(id);
  if (!record) return { success: false, error: 'Not found' };

  const affiliateRecord = await getAffiliateByUserId(session.userId);
  if (!affiliateRecord || record.affiliateId !== affiliateRecord.id) {
    return { success: false, error: 'Not found' };
  }

  await db
    .update(promoCode)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(promoCode.id, id));

  await deactivateStripeIfExists(record.code);

  await db.insert(auditEvent).values({
    actorType: 'USER',
    actorId: session.userId,
    action: 'PROMO_CODE_DELETED',
    subject: 'PromoCode',
    subjectId: id,
    severity: 'LOW',
    detailsJson: { code: record.code },
  });

  revalidatePath('/my/selling/affiliate');
  return { success: true };
}
