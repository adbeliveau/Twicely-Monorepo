'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@twicely/db';
import { sellerProfile, promotion } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { authorize, sub } from '@twicely/casl';
import { canUseFeature } from '@twicely/utils/tier-gates';
import { validateCouponCodeFormat, normalizeCouponCode } from '@twicely/commerce/promotions';
import { couponCodeExists, countActivePromotions } from '@/lib/queries/promotions';
import { z } from 'zod';

const createPromotionSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['PERCENT_OFF', 'AMOUNT_OFF', 'FREE_SHIPPING', 'BUNDLE_DISCOUNT']),
  scope: z.enum(['STORE_WIDE', 'CATEGORY', 'SPECIFIC_LISTINGS']),
  discountPercent: z.number().int().min(1).max(95).optional(), // Max 95% — platform retains minimum TF
  discountAmountCents: z.number().int().positive().optional(),
  minimumOrderCents: z.number().int().nonnegative().optional(),
  maxUsesTotal: z.number().int().positive().optional(),
  maxUsesPerBuyer: z.number().int().positive().optional(),
  couponCode: z.string().min(4).max(20).optional(),
  applicableCategoryIds: z.array(z.string().cuid2()).optional(),
  applicableListingIds: z.array(z.string().cuid2()).optional(),
  startsAt: z.string().refine((s) => !isNaN(new Date(s).getTime()), 'Invalid date'),
  endsAt: z.string().refine((s) => !isNaN(new Date(s).getTime()), 'Invalid date').optional(),
}).strict().refine(
  (data) => {
    if (data.endsAt && data.startsAt) {
      return new Date(data.endsAt) > new Date(data.startsAt);
    }
    return true;
  },
  { message: 'End date must be after start date' }
);

const updatePromotionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z.enum(['PERCENT_OFF', 'AMOUNT_OFF', 'FREE_SHIPPING', 'BUNDLE_DISCOUNT']).optional(),
  scope: z.enum(['STORE_WIDE', 'CATEGORY', 'SPECIFIC_LISTINGS']).optional(),
  discountPercent: z.number().int().min(1).max(95).optional(), // Max 95% — platform retains minimum TF
  discountAmountCents: z.number().int().positive().optional(),
  minimumOrderCents: z.number().int().nonnegative().optional(),
  maxUsesTotal: z.number().int().positive().optional(),
  maxUsesPerBuyer: z.number().int().positive().optional(),
  couponCode: z.string().min(4).max(20).optional(),
  applicableCategoryIds: z.array(z.string().cuid2()).optional(),
  applicableListingIds: z.array(z.string().cuid2()).optional(),
  startsAt: z.string().refine((s) => !isNaN(new Date(s).getTime()), 'Invalid date').optional(),
  endsAt: z.string().refine((s) => !isNaN(new Date(s).getTime()), 'Invalid date').optional(),
}).strict();

const updatePromotionIdSchema = z.object({
  promotionId: z.string().min(1, 'Promotion ID is required'),
}).strict();

interface ActionResult { success: boolean; error?: string }
interface CreateActionResult extends ActionResult { promotionId?: string }
type PromotionType = 'PERCENT_OFF' | 'AMOUNT_OFF' | 'FREE_SHIPPING' | 'BUNDLE_DISCOUNT';
type PromotionScope = 'STORE_WIDE' | 'CATEGORY' | 'SPECIFIC_LISTINGS';

export interface CreatePromotionInput {
  name: string; type: PromotionType; scope: PromotionScope;
  discountPercent?: number; discountAmountCents?: number; minimumOrderCents?: number;
  maxUsesTotal?: number; maxUsesPerBuyer?: number; couponCode?: string;
  applicableCategoryIds?: string[]; applicableListingIds?: string[];
  startsAt: string; endsAt?: string;
}

async function getSellerProfileWithTier(userId: string) {
  const [row] = await db.select({ id: sellerProfile.id, storeTier: sellerProfile.storeTier })
    .from(sellerProfile).where(eq(sellerProfile.userId, userId)).limit(1);
  return row ?? null;
}

function validateCreateInput(data: CreatePromotionInput): ActionResult {
  if (!data.name || data.name.length < 1 || data.name.length > 100)
    return { success: false, error: 'Name must be 1-100 characters' };
  if ((data.type === 'PERCENT_OFF' || data.type === 'BUNDLE_DISCOUNT') &&
      (data.discountPercent === undefined || data.discountPercent < 1 || data.discountPercent > 100))
    return { success: false, error: 'Discount percent must be between 1 and 100' };
  if (data.type === 'AMOUNT_OFF' && (data.discountAmountCents === undefined || data.discountAmountCents < 1))
    return { success: false, error: 'Discount amount must be greater than 0' };
  if (data.scope === 'CATEGORY' && (!data.applicableCategoryIds || data.applicableCategoryIds.length === 0))
    return { success: false, error: 'At least one category is required for category-scoped promotions' };
  if (data.scope === 'SPECIFIC_LISTINGS' && (!data.applicableListingIds || data.applicableListingIds.length === 0))
    return { success: false, error: 'At least one listing is required for listing-scoped promotions' };
  if (data.couponCode && !validateCouponCodeFormat(data.couponCode))
    return { success: false, error: 'Coupon code must be 4-20 characters, alphanumeric with optional hyphens' };
  const startsAt = new Date(data.startsAt);
  if (isNaN(startsAt.getTime())) return { success: false, error: 'Invalid start date' };
  if (data.endsAt) {
    const endsAt = new Date(data.endsAt);
    if (isNaN(endsAt.getTime())) return { success: false, error: 'Invalid end date' };
    if (endsAt <= startsAt) return { success: false, error: 'End date must be after start date' };
  }
  if (data.maxUsesTotal !== undefined && data.maxUsesTotal < 1)
    return { success: false, error: 'Max uses must be at least 1' };
  if (data.maxUsesPerBuyer !== undefined && data.maxUsesPerBuyer < 1)
    return { success: false, error: 'Max uses per buyer must be at least 1' };
  return { success: true };
}

export async function createPromotion(data: CreatePromotionInput): Promise<CreateActionResult> {
  const parsed = createPromotionSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const { ability, session } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };
  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;
  if (!ability.can('create', sub('Promotion', { sellerId: userId }))) {
    return { success: false, error: 'Forbidden' };
  }
  const profile = await getSellerProfileWithTier(userId);
  if (!profile) return { success: false, error: 'Seller profile required' };
  if (!canUseFeature(profile.storeTier, 'promotions'))
    return { success: false, error: 'Promotions require Pro plan or higher' };
  const validation = validateCreateInput(data);
  if (!validation.success) return validation;
  if (data.couponCode) {
    const normalized = normalizeCouponCode(data.couponCode);
    if (await couponCodeExists(normalized)) return { success: false, error: 'This coupon code is already in use' };
  }
  const activeCount = await countActivePromotions(userId);
  if (activeCount >= 50)
    return { success: false, error: 'Maximum 50 active promotions allowed. Deactivate some before creating new ones.' };
  const [newPromotion] = await db.insert(promotion).values({
    sellerId: userId, name: data.name, type: data.type, scope: data.scope,
    discountPercent: data.discountPercent ?? null, discountAmountCents: data.discountAmountCents ?? null,
    minimumOrderCents: data.minimumOrderCents ?? null, maxUsesTotal: data.maxUsesTotal ?? null,
    maxUsesPerBuyer: data.maxUsesPerBuyer ?? 1,
    couponCode: data.couponCode ? normalizeCouponCode(data.couponCode) : null,
    applicableCategoryIds: data.applicableCategoryIds ?? [], applicableListingIds: data.applicableListingIds ?? [],
    startsAt: new Date(data.startsAt), endsAt: data.endsAt ? new Date(data.endsAt) : null,
    isActive: true, usageCount: 0,
  }).returning({ id: promotion.id });
  revalidatePath('/my/selling/promotions');
  return { success: true, promotionId: newPromotion?.id };
}

export async function updatePromotion(promotionId: string, data: Partial<CreatePromotionInput>): Promise<ActionResult> {
  const parsedId = updatePromotionIdSchema.safeParse({ promotionId });
  if (!parsedId.success) {
    return { success: false, error: parsedId.error.issues[0]?.message ?? 'Invalid promotion ID' };
  }
  const parsedData = updatePromotionSchema.safeParse(data);
  if (!parsedData.success) {
    return { success: false, error: parsedData.error.issues[0]?.message ?? 'Invalid input' };
  }
  const { ability, session } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };
  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;
  if (!ability.can('update', sub('Promotion', { sellerId: userId }))) {
    return { success: false, error: 'Forbidden' };
  }
  const [existing] = await db.select({ id: promotion.id, sellerId: promotion.sellerId })
    .from(promotion).where(eq(promotion.id, promotionId)).limit(1);
  if (!existing) return { success: false, error: 'Promotion not found' };
  if (existing.sellerId !== userId) return { success: false, error: 'Forbidden' };
  const profile = await getSellerProfileWithTier(userId);
  if (!profile || !canUseFeature(profile.storeTier, 'promotions'))
    return { success: false, error: 'Promotions require Pro plan or higher' };

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (data.name !== undefined) {
    if (data.name.length < 1 || data.name.length > 100) return { success: false, error: 'Name must be 1-100 characters' };
    updates.name = data.name;
  }
  if (data.discountPercent !== undefined) {
    if (data.discountPercent < 1 || data.discountPercent > 100)
      return { success: false, error: 'Discount percent must be between 1 and 100' };
    updates.discountPercent = data.discountPercent;
  }
  if (data.discountAmountCents !== undefined) {
    if (data.discountAmountCents < 1) return { success: false, error: 'Discount amount must be greater than 0' };
    updates.discountAmountCents = data.discountAmountCents;
  }
  if (data.minimumOrderCents !== undefined) updates.minimumOrderCents = data.minimumOrderCents;
  if (data.maxUsesTotal !== undefined) updates.maxUsesTotal = data.maxUsesTotal;
  if (data.maxUsesPerBuyer !== undefined) updates.maxUsesPerBuyer = data.maxUsesPerBuyer;
  if (data.applicableCategoryIds !== undefined) updates.applicableCategoryIds = data.applicableCategoryIds;
  if (data.applicableListingIds !== undefined) updates.applicableListingIds = data.applicableListingIds;
  if (data.couponCode !== undefined) {
    if (data.couponCode && !validateCouponCodeFormat(data.couponCode))
      return { success: false, error: 'Coupon code must be 4-20 characters, alphanumeric with optional hyphens' };
    if (data.couponCode) {
      const normalized = normalizeCouponCode(data.couponCode);
      if (await couponCodeExists(normalized, promotionId)) return { success: false, error: 'This coupon code is already in use' };
      updates.couponCode = normalized;
    } else { updates.couponCode = null; }
  }
  if (data.startsAt !== undefined) {
    const startsAt = new Date(data.startsAt);
    if (isNaN(startsAt.getTime())) return { success: false, error: 'Invalid start date' };
    updates.startsAt = startsAt;
  }
  if (data.endsAt !== undefined) {
    if (data.endsAt) {
      const endsAt = new Date(data.endsAt);
      if (isNaN(endsAt.getTime())) return { success: false, error: 'Invalid end date' };
      updates.endsAt = endsAt;
    } else { updates.endsAt = null; }
  }
  await db.update(promotion).set(updates).where(eq(promotion.id, promotionId));
  revalidatePath('/my/selling/promotions');
  return { success: true };
}

export async function deactivatePromotion(promotionId: string): Promise<ActionResult> {
  const { ability, session } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };
  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;
  if (!ability.can('update', sub('Promotion', { sellerId: userId }))) {
    return { success: false, error: 'Forbidden' };
  }
  const [existing] = await db.select({ id: promotion.id, sellerId: promotion.sellerId })
    .from(promotion).where(eq(promotion.id, promotionId)).limit(1);
  if (!existing) return { success: false, error: 'Promotion not found' };
  if (existing.sellerId !== userId) return { success: false, error: 'Forbidden' };
  await db.update(promotion).set({ isActive: false, updatedAt: new Date() }).where(eq(promotion.id, promotionId));
  revalidatePath('/my/selling/promotions');
  return { success: true };
}

export async function reactivatePromotion(promotionId: string): Promise<ActionResult> {
  const { ability, session } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };
  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;
  if (!ability.can('update', sub('Promotion', { sellerId: userId }))) {
    return { success: false, error: 'Forbidden' };
  }
  const [existing] = await db.select({ id: promotion.id, sellerId: promotion.sellerId, endsAt: promotion.endsAt })
    .from(promotion).where(eq(promotion.id, promotionId)).limit(1);
  if (!existing) return { success: false, error: 'Promotion not found' };
  if (existing.sellerId !== userId) return { success: false, error: 'Forbidden' };
  if (existing.endsAt && existing.endsAt < new Date())
    return { success: false, error: 'Cannot reactivate an expired promotion' };
  await db.update(promotion).set({ isActive: true, updatedAt: new Date() }).where(eq(promotion.id, promotionId));
  revalidatePath('/my/selling/promotions');
  return { success: true };
}
