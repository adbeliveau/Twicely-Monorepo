import { db } from '@twicely/db';
import { listingChild, listing } from '@twicely/db/schema';
import { eq, and, asc, sql } from 'drizzle-orm';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import type { CreateListingChildInput, UpdateListingChildInput, ListingChild } from './types';

/** Auto-generate a SKU from listing ID and variation combo */
function generateSku(listingId: string, combo: Record<string, string>): string {
  const suffix = Object.values(combo).join('-').toLowerCase().replace(/\s+/g, '').slice(0, 20);
  return listingId.slice(-8) + '-' + suffix;
}

export async function createListingChild(
  input: CreateListingChildInput
): Promise<ListingChild> {
  const maxSkus = await getPlatformSetting<number>('catalog.variations.maxSkuCombinations', 250);

  // Check existing children count
  const existing = await db.select({ id: listingChild.id })
    .from(listingChild)
    .where(eq(listingChild.parentListingId, input.parentListingId));

  if (existing.length >= maxSkus) {
    throw new Error('Maximum SKU combinations reached: ' + maxSkus);
  }

  if (input.priceCents <= 0) {
    throw new Error('priceCents must be greater than 0');
  }

  const sku = input.sku ?? generateSku(input.parentListingId, input.variationCombination);
  const qty = input.quantity;

  // If isDefault requested, clear any existing defaults
  if (input.isDefault) {
    await db.update(listingChild)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(and(
        eq(listingChild.parentListingId, input.parentListingId),
        eq(listingChild.isDefault, true),
      ));
  }

  const [row] = await db.insert(listingChild).values({
    parentListingId: input.parentListingId,
    variationCombination: input.variationCombination,
    sku,
    priceCents: input.priceCents,
    compareAtPriceCents: input.compareAtPriceCents ?? null,
    costCents: input.costCents ?? null,
    quantity: qty,
    availableQuantity: qty,
    reservedQuantity: 0,
    weightOz: input.weightOz ?? null,
    barcode: input.barcode ?? null,
    isDefault: input.isDefault ?? false,
  }).returning();

  // Mark parent as having variations
  await db.update(listing)
    .set({ hasVariations: true, updatedAt: new Date() })
    .where(eq(listing.id, input.parentListingId));

  return row;
}

export async function updateListingChild(
  id: string,
  input: UpdateListingChildInput
): Promise<ListingChild> {
  const [existing] = await db.select()
    .from(listingChild)
    .where(eq(listingChild.id, id))
    .limit(1);

  if (!existing) throw new Error('Listing child not found');

  // If updating quantity, recalculate availableQuantity
  const updates: Record<string, unknown> = { ...input, updatedAt: new Date() };
  if (input.quantity !== undefined) {
    updates.availableQuantity = input.quantity - existing.reservedQuantity;
  }

  // If isDefault requested, clear others
  if (input.isDefault) {
    await db.update(listingChild)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(and(
        eq(listingChild.parentListingId, existing.parentListingId),
        eq(listingChild.isDefault, true),
      ));
  }

  const [row] = await db.update(listingChild)
    .set(updates)
    .where(eq(listingChild.id, id))
    .returning();
  return row;
}

export async function deleteListingChild(id: string): Promise<void> {
  const [child] = await db.select()
    .from(listingChild)
    .where(eq(listingChild.id, id))
    .limit(1);
  if (!child) return;

  await db.delete(listingChild).where(eq(listingChild.id, id));

  // Check if parent still has children
  const remaining = await db.select({ id: listingChild.id })
    .from(listingChild)
    .where(eq(listingChild.parentListingId, child.parentListingId))
    .limit(1);

  if (remaining.length === 0) {
    await db.update(listing)
      .set({ hasVariations: false, updatedAt: new Date() })
      .where(eq(listing.id, child.parentListingId));
  }
}

export async function getListingChildren(
  listingId: string
): Promise<ListingChild[]> {
  return db.select().from(listingChild)
    .where(eq(listingChild.parentListingId, listingId))
    .orderBy(asc(listingChild.createdAt));
}

export async function bulkCreateChildren(
  listingId: string,
  children: CreateListingChildInput[]
): Promise<ListingChild[]> {
  const results: ListingChild[] = [];
  for (const child of children) {
    const result = await createListingChild({
      ...child,
      parentListingId: listingId,
    });
    results.push(result);
  }
  return results;
}
