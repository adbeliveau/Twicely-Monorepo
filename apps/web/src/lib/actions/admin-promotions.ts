'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@twicely/db';
import { promotion, auditEvent } from '@twicely/db/schema';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { adminPromotionIdSchema } from '@/lib/validations/admin-promotions';
import { createPlatformPromoCodeSchema, updatePromoCodeSchema } from '@/lib/validations/promo-code';
import { getPromoCodeByCode } from '@/lib/queries/promo-codes';
import { createPlatformPromoCode, updatePlatformPromoCode } from './promo-codes-platform';

interface ActionResult {
  success: boolean;
  error?: string;
}

// ─── Action 1: adminDeactivatePromotion ──────────────────────────────────────

export async function adminDeactivatePromotion(input: unknown): Promise<ActionResult> {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('manage', 'Promotion')) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = adminPromotionIdSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const [existing] = await db
    .select({ id: promotion.id })
    .from(promotion)
    .where(eq(promotion.id, parsed.data.promotionId))
    .limit(1);

  if (!existing) return { success: false, error: 'Not found' };

  await db
    .update(promotion)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(promotion.id, parsed.data.promotionId));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'ADMIN_PROMOTION_DEACTIVATED',
    subject: 'Promotion',
    subjectId: parsed.data.promotionId,
    severity: 'MEDIUM',
    detailsJson: { promotionId: parsed.data.promotionId },
  });

  revalidatePath('/promotions');
  revalidatePath(`/promotions/${parsed.data.promotionId}`);
  return { success: true };
}

// ─── Action 2: adminReactivatePromotion ──────────────────────────────────────

export async function adminReactivatePromotion(input: unknown): Promise<ActionResult> {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('manage', 'Promotion')) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = adminPromotionIdSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const [existing] = await db
    .select({ id: promotion.id, endsAt: promotion.endsAt })
    .from(promotion)
    .where(eq(promotion.id, parsed.data.promotionId))
    .limit(1);

  if (!existing) return { success: false, error: 'Not found' };

  if (existing.endsAt && existing.endsAt < new Date()) {
    return { success: false, error: 'Cannot reactivate an expired promotion' };
  }

  await db
    .update(promotion)
    .set({ isActive: true, updatedAt: new Date() })
    .where(eq(promotion.id, parsed.data.promotionId));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'ADMIN_PROMOTION_REACTIVATED',
    subject: 'Promotion',
    subjectId: parsed.data.promotionId,
    severity: 'MEDIUM',
    detailsJson: { promotionId: parsed.data.promotionId },
  });

  revalidatePath('/promotions');
  return { success: true };
}

// ─── Action 3: adminCreatePlatformPromoCode ───────────────────────────────────

export async function adminCreatePlatformPromoCode(input: unknown): Promise<ActionResult> {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'PromoCode')) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = createPlatformPromoCodeSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const existing = await getPromoCodeByCode(parsed.data.code);
  if (existing) return { success: false, error: 'This code is already in use' };

  const result = await createPlatformPromoCode(input);
  if (!result.success) return result;

  revalidatePath('/promotions');
  return { success: true };
}

// ─── Action 4: adminUpdatePromoCode ──────────────────────────────────────────

export async function adminUpdatePromoCode(input: unknown): Promise<ActionResult> {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'PromoCode')) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = updatePromoCodeSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const result = await updatePlatformPromoCode(input);
  if (!result.success) return result;

  revalidatePath('/promotions');
  return { success: true };
}
