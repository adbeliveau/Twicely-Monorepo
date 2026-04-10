import { db } from '@twicely/db';
import { variationValue, variationType } from '@twicely/db/schema';
import { eq, and, sql, lt, asc, desc } from 'drizzle-orm';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import type { CreateVariationValueInput, VariationValue } from './types';

/** Normalize a variation value for dedup comparison */
export function normalizeValue(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, ' ');
}

export async function createVariationValue(
  input: CreateVariationValueInput
): Promise<VariationValue> {
  const normalized = normalizeValue(input.value);

  // Check for duplicate within same type+scope+category+seller
  const [existing] = await db.select()
    .from(variationValue)
    .where(and(
      eq(variationValue.variationTypeId, input.variationTypeId),
      eq(variationValue.normalizedValue, normalized),
      eq(variationValue.scope, input.scope),
      input.categoryId ? eq(variationValue.categoryId, input.categoryId) : sql`${variationValue.categoryId} IS NULL`,
      input.sellerId ? eq(variationValue.sellerId, input.sellerId) : sql`${variationValue.sellerId} IS NULL`,
    ))
    .limit(1);

  if (existing) {
    throw new Error('Duplicate variation value within the same scope');
  }

  const [row] = await db.insert(variationValue).values({
    variationTypeId: input.variationTypeId,
    value: input.value,
    normalizedValue: normalized,
    scope: input.scope,
    categoryId: input.categoryId ?? null,
    sellerId: input.sellerId ?? null,
    colorHex: input.colorHex ?? null,
    imageUrl: input.imageUrl ?? null,
  }).returning();
  return row;
}

export async function getVariationValues(args: {
  variationTypeId: string;
  categoryId?: string;
  sellerId?: string;
}): Promise<{
  platform: VariationValue[];
  category: VariationValue[];
  seller: VariationValue[];
}> {
  const platform = await db.select().from(variationValue)
    .where(and(
      eq(variationValue.variationTypeId, args.variationTypeId),
      eq(variationValue.scope, 'PLATFORM'),
      eq(variationValue.isActive, true),
    ))
    .orderBy(desc(variationValue.usageCount));

  const category = args.categoryId ? await db.select().from(variationValue)
    .where(and(
      eq(variationValue.variationTypeId, args.variationTypeId),
      eq(variationValue.scope, 'CATEGORY'),
      eq(variationValue.categoryId, args.categoryId),
      eq(variationValue.isActive, true),
    ))
    .orderBy(asc(variationValue.sortOrder)) : [];

  const seller = args.sellerId ? await db.select().from(variationValue)
    .where(and(
      eq(variationValue.variationTypeId, args.variationTypeId),
      eq(variationValue.scope, 'SELLER'),
      eq(variationValue.sellerId, args.sellerId),
      eq(variationValue.isActive, true),
    ))
    .orderBy(asc(variationValue.sortOrder)) : [];

  return { platform, category, seller };
}

export async function promoteValueToPlatform(
  valueId: string,
  staffUserId: string
): Promise<void> {
  await db.update(variationValue)
    .set({
      scope: 'PLATFORM',
      promotedAt: new Date(),
      promotedBy: staffUserId,
      updatedAt: new Date(),
    })
    .where(eq(variationValue.id, valueId));
}

export async function deactivateValue(valueId: string): Promise<void> {
  await db.update(variationValue)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(variationValue.id, valueId));
}

export async function bulkCleanupUnusedValues(args?: {
  dryRun?: boolean;
}): Promise<{ removed: number }> {
  const cleanupDays = await getPlatformSetting<number>('catalog.variations.unusedValueCleanupDays', 90);
  const cutoff = new Date(Date.now() - cleanupDays * 24 * 60 * 60 * 1000);

  const unused = await db.select({ id: variationValue.id }).from(variationValue)
    .where(and(
      eq(variationValue.scope, 'SELLER'),
      eq(variationValue.usageCount, 0),
      eq(variationValue.isActive, true),
      lt(variationValue.createdAt, cutoff),
    ));

  if (args?.dryRun || unused.length === 0) {
    return { removed: unused.length };
  }

  for (const row of unused) {
    await db.update(variationValue)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(variationValue.id, row.id));
  }

  return { removed: unused.length };
}
