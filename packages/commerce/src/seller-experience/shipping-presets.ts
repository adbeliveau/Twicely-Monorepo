import { db } from '@twicely/db';
import { shippingPreset } from '@twicely/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import type { ShippingPresetInput } from './types';

interface PresetRow {
  id: string;
  sellerId: string;
  name: string;
  carrier: string;
  serviceType: string;
  weightOz: number | null;
  lengthIn: number | null;
  widthIn: number | null;
  heightIn: number | null;
  freeShippingThresholdCents: number | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create a new shipping preset for a seller.
 */
export async function createPreset(
  sellerId: string,
  input: ShippingPresetInput
): Promise<{ id: string }> {
  const id = createId();
  await db.insert(shippingPreset).values({
    id,
    sellerId,
    name: input.name,
    carrier: input.carrier,
    serviceType: input.serviceType,
    weightOz: input.weightOz ?? null,
    lengthIn: input.lengthIn ?? null,
    widthIn: input.widthIn ?? null,
    heightIn: input.heightIn ?? null,
    freeShippingThresholdCents: input.freeShippingThresholdCents ?? null,
    isDefault: false,
  });
  return { id };
}

/**
 * Update an existing shipping preset.
 */
export async function updatePreset(
  id: string,
  input: Partial<ShippingPresetInput>
): Promise<void> {
  await db
    .update(shippingPreset)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.carrier !== undefined && { carrier: input.carrier }),
      ...(input.serviceType !== undefined && { serviceType: input.serviceType }),
      ...(input.weightOz !== undefined && { weightOz: input.weightOz }),
      ...(input.lengthIn !== undefined && { lengthIn: input.lengthIn }),
      ...(input.widthIn !== undefined && { widthIn: input.widthIn }),
      ...(input.heightIn !== undefined && { heightIn: input.heightIn }),
      ...(input.freeShippingThresholdCents !== undefined && { freeShippingThresholdCents: input.freeShippingThresholdCents }),
      updatedAt: new Date(),
    })
    .where(eq(shippingPreset.id, id));
}

/**
 * Delete a shipping preset.
 */
export async function deletePreset(id: string): Promise<void> {
  await db
    .delete(shippingPreset)
    .where(eq(shippingPreset.id, id));
}

/**
 * Get all shipping presets for a seller.
 */
export async function getPresets(sellerId: string): Promise<PresetRow[]> {
  const rows = await db
    .select({
      id: shippingPreset.id,
      sellerId: shippingPreset.sellerId,
      name: shippingPreset.name,
      carrier: shippingPreset.carrier,
      serviceType: shippingPreset.serviceType,
      weightOz: shippingPreset.weightOz,
      lengthIn: shippingPreset.lengthIn,
      widthIn: shippingPreset.widthIn,
      heightIn: shippingPreset.heightIn,
      freeShippingThresholdCents: shippingPreset.freeShippingThresholdCents,
      isDefault: shippingPreset.isDefault,
      createdAt: shippingPreset.createdAt,
      updatedAt: shippingPreset.updatedAt,
    })
    .from(shippingPreset)
    .where(eq(shippingPreset.sellerId, sellerId))
    .orderBy(desc(shippingPreset.createdAt));

  return rows as unknown as PresetRow[];
}

/**
 * Set a specific preset as the default for a seller.
 * Clears the default flag on all other presets first.
 */
export async function setDefaultPreset(presetId: string): Promise<void> {
  // Get the seller ID for this preset
  const [preset] = await db
    .select({ sellerId: shippingPreset.sellerId })
    .from(shippingPreset)
    .where(eq(shippingPreset.id, presetId))
    .limit(1);

  if (!preset) {
    throw new Error('PRESET_NOT_FOUND');
  }

  // Clear all defaults for this seller
  await db
    .update(shippingPreset)
    .set({ isDefault: false, updatedAt: new Date() })
    .where(eq(shippingPreset.sellerId, preset.sellerId));

  // Set the new default
  await db
    .update(shippingPreset)
    .set({ isDefault: true, updatedAt: new Date() })
    .where(eq(shippingPreset.id, presetId));
}
