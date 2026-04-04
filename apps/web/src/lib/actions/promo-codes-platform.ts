'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@twicely/db';
import { promoCode, auditEvent } from '@twicely/db/schema';
import { authorize } from '@twicely/casl';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getPromoCodeByCode, getPromoCodeById, hasUserRedeemedPromoCode } from '@/lib/queries/promo-codes';
import { createPlatformPromoCodeSchema, updatePromoCodeSchema, applyPromoCodeSchema } from '@/lib/validations/promo-code';
import { syncPromoCodeToStripe } from '@twicely/stripe/promo-codes';
import { deactivateStripeIfExists } from './promo-codes-helpers';

interface ActionResult {
  success: boolean;
  error?: string;
}

interface ValidatePromoCodeResult {
  valid: boolean;
  discountType?: string;
  discountValue?: number;
  durationMonths?: number;
  type?: string;
  error?: string;
}

// ─── Action 4: createPlatformPromoCode ──────────────────────────────────────

export async function createPlatformPromoCode(
  input: unknown,
): Promise<ActionResult> {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('manage', 'PromoCode')) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = createPlatformPromoCodeSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const data = parsed.data;

  const existing = await getPromoCodeByCode(data.code);
  if (existing) return { success: false, error: 'This code is already in use' };

  const [inserted] = await db
    .insert(promoCode)
    .values({
      code: data.code,
      type: 'PLATFORM',
      affiliateId: null,
      discountType: data.discountType,
      discountValue: data.discountValue,
      durationMonths: data.durationMonths,
      scopeProductTypes: data.scopeProductTypes ?? null,
      usageLimit: data.usageLimit ?? null,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      isActive: true,
      createdByUserId: session.staffUserId,
    })
    .returning();

  if (!inserted) return { success: false, error: 'Failed to create promo code' };

  try {
    await syncPromoCodeToStripe(inserted);
  } catch {
    // Stripe sync failure does not block creation
  }

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'PLATFORM_PROMO_CODE_CREATED',
    subject: 'PromoCode',
    subjectId: inserted.id,
    severity: 'MEDIUM',
    detailsJson: { code: inserted.code, type: 'PLATFORM' },
  });

  revalidatePath('/fin/promo-codes');
  return { success: true };
}

// ─── Action 5: updatePlatformPromoCode ──────────────────────────────────────

export async function updatePlatformPromoCode(
  input: unknown,
): Promise<ActionResult> {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('manage', 'PromoCode')) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = updatePromoCodeSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const data = parsed.data;

  const record = await getPromoCodeById(data.id);
  if (!record) return { success: false, error: 'Not found' };

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
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'PLATFORM_PROMO_CODE_UPDATED',
    subject: 'PromoCode',
    subjectId: data.id,
    severity: 'MEDIUM',
    detailsJson: { isActive: data.isActive },
  });

  revalidatePath('/fin/promo-codes');
  return { success: true };
}

// ─── Action 6: validatePromoCode ────────────────────────────────────────────

export async function validatePromoCode(
  input: unknown,
): Promise<ValidatePromoCodeResult> {
  const { session } = await authorize();
  if (!session) return { valid: false, error: 'Unauthorized' };

  const parsed = applyPromoCodeSchema.safeParse(input);
  if (!parsed.success) {
    return { valid: false, error: 'Invalid input' };
  }
  const { code, product } = parsed.data;

  const record = await getPromoCodeByCode(code);
  if (!record) return { valid: false, error: 'Promo code not found' };
  if (!record.isActive) return { valid: false, error: 'This promo code is no longer active' };

  const now = new Date();
  if (record.expiresAt && record.expiresAt <= now) {
    return { valid: false, error: 'This promo code has expired' };
  }

  if (record.usageLimit !== null && record.usageCount >= record.usageLimit) {
    return { valid: false, error: 'This promo code has reached its usage limit' };
  }

  const scopeTypes = record.scopeProductTypes as string[] | null;
  if (scopeTypes && !scopeTypes.includes(product)) {
    return { valid: false, error: 'This promo code cannot be applied to this product' };
  }

  const alreadyRedeemed = await hasUserRedeemedPromoCode(
    record.id,
    session.userId,
    product,
  );
  if (alreadyRedeemed) {
    return { valid: false, error: 'You have already used this promo code for this product' };
  }

  return {
    valid: true,
    discountType: record.discountType,
    discountValue: record.discountValue,
    durationMonths: record.durationMonths,
    type: record.type,
  };
}

