import { db } from '@twicely/db';
import {
  listingVariation,
  listingVariationOption,
  listingChild,
  variationType,
  categoryVariationType,
  listing,
} from '@twicely/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import type { SetVariationsInput, VariationMatrix, ListingChild } from './types';

export async function setListingVariations(
  listingId: string,
  input: SetVariationsInput
): Promise<void> {
  const maxDimensions = await getPlatformSetting<number>(
    'catalog.variations.maxDimensionsPerListing', 3
  );

  // Hard cap 5
  const effectiveMax = Math.min(maxDimensions, 5);
  if (input.dimensions.length > effectiveMax) {
    throw new Error('Maximum ' + effectiveMax + ' variation dimensions per listing');
  }

  // Delete existing variations for this listing
  await db.delete(listingVariation)
    .where(eq(listingVariation.listingId, listingId));

  // Insert new dimensions and their values
  for (let i = 0; i < input.dimensions.length; i++) {
    const dim = input.dimensions[i];
    const [lv] = await db.insert(listingVariation).values({
      listingId,
      variationTypeId: dim.variationTypeId,
      sortOrder: i,
    }).returning();

    for (let j = 0; j < dim.values.length; j++) {
      const val = dim.values[j];
      await db.insert(listingVariationOption).values({
        listingVariationId: lv.id,
        variationValueId: val.variationValueId ?? null,
        customValue: val.customValue ?? null,
        displayValue: val.displayValue,
        sortOrder: j,
      });
    }
  }
}

export async function getListingVariationMatrix(
  listingId: string
): Promise<VariationMatrix> {
  // Get variation dimensions
  const dims = await db.select({
    lvId: listingVariation.id,
    variationTypeId: listingVariation.variationTypeId,
    typeName: variationType.label,
    sortOrder: listingVariation.sortOrder,
  })
    .from(listingVariation)
    .innerJoin(variationType, eq(listingVariation.variationTypeId, variationType.id))
    .where(eq(listingVariation.listingId, listingId))
    .orderBy(asc(listingVariation.sortOrder));

  const dimensions: VariationMatrix['dimensions'] = [];
  for (const dim of dims) {
    const values = await db.select({
      id: listingVariationOption.id,
      displayValue: listingVariationOption.displayValue,
      variationValueId: listingVariationOption.variationValueId,
    })
      .from(listingVariationOption)
      .where(eq(listingVariationOption.listingVariationId, dim.lvId))
      .orderBy(asc(listingVariationOption.sortOrder));

    dimensions.push({
      variationTypeId: dim.variationTypeId,
      typeName: dim.typeName,
      values,
    });
  }

  // Get all children
  const children: ListingChild[] = await db.select()
    .from(listingChild)
    .where(eq(listingChild.parentListingId, listingId))
    .orderBy(asc(listingChild.createdAt));

  return { dimensions, children };
}

export async function applyCategoryDefaults(
  listingId: string,
  categoryId: string
): Promise<void> {
  // Get category's recommended variation types
  const catTypes = await db.select({
    variationTypeId: categoryVariationType.variationTypeId,
    sortOrder: categoryVariationType.sortOrder,
  })
    .from(categoryVariationType)
    .where(eq(categoryVariationType.categoryId, categoryId))
    .orderBy(asc(categoryVariationType.sortOrder));

  if (catTypes.length === 0) return;

  // Check if listing already has variations set
  const existing = await db.select({ id: listingVariation.id })
    .from(listingVariation)
    .where(eq(listingVariation.listingId, listingId))
    .limit(1);

  if (existing.length > 0) return; // Already has variations, don't overwrite

  // Insert default variation dimensions (no values yet)
  for (const ct of catTypes) {
    await db.insert(listingVariation).values({
      listingId,
      variationTypeId: ct.variationTypeId,
      sortOrder: ct.sortOrder,
    });
  }
}
