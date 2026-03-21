'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@twicely/db';
import { shippingProfile } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import { authorize, sub } from '@twicely/casl';
import {
  createShippingProfileSchema,
  updateShippingProfileSchema,
  type CreateShippingProfileInput,
  type UpdateShippingProfileInput,
} from '@/lib/validations/shipping-profile';
import { getShippingProfileById, getShippingProfileLimit } from '@/lib/queries/shipping-profiles';
import { logger } from '@twicely/logger';

interface ActionResult {
  success: boolean;
  profileId?: string;
  error?: string;
}

/**
 * Create a new shipping profile
 */
export async function createShippingProfile(
  data: CreateShippingProfileInput
): Promise<ActionResult> {
  const { ability, session } = await authorize();

  if (!session) {
    return { success: false, error: 'Not authenticated' };
  }

  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;

  // CASL authorization check - user must be able to manage ShippingProfile
  if (!ability.can('manage', sub('ShippingProfile', { userId }))) {
    return { success: false, error: 'Not authorized to manage shipping profiles' };
  }

  // Validate input
  const validated = createShippingProfileSchema.safeParse(data);
  if (!validated.success) {
    return { success: false, error: 'Invalid input' };
  }

  try {
    // Check profile limit
    const { limit, currentCount } = await getShippingProfileLimit(userId);

    if (currentCount >= limit) {
      return {
        success: false,
        error: `Profile limit reached. You can have up to ${limit} profiles.`,
      };
    }

    // If this is the first profile, make it default
    const isFirstProfile = currentCount === 0;

    // Build insert data based on combined shipping mode
    const insertData: {
      userId: string;
      name: string;
      carrier: string;
      service?: string;
      handlingTimeDays: number;
      isDefault: boolean;
      weightOz?: number;
      lengthIn?: number;
      widthIn?: number;
      heightIn?: number;
      combinedShippingMode: 'NONE' | 'FLAT' | 'PER_ADDITIONAL' | 'AUTO_DISCOUNT' | 'QUOTED';
      flatCombinedCents?: number;
      additionalItemCents?: number;
      autoDiscountPercent?: number;
      autoDiscountMinItems?: number;
    } = {
      userId,
      name: validated.data.name,
      carrier: validated.data.carrier,
      service: validated.data.service,
      handlingTimeDays: validated.data.handlingTimeDays,
      isDefault: validated.data.isDefault || isFirstProfile,
      weightOz: validated.data.weightOz,
      lengthIn: validated.data.lengthIn,
      widthIn: validated.data.widthIn,
      heightIn: validated.data.heightIn,
      combinedShippingMode: validated.data.combinedShippingMode,
    };

    // Add mode-specific fields
    if (validated.data.combinedShippingMode === 'FLAT') {
      insertData.flatCombinedCents = validated.data.flatCombinedCents;
    } else if (validated.data.combinedShippingMode === 'PER_ADDITIONAL') {
      insertData.additionalItemCents = validated.data.additionalItemCents;
    } else if (validated.data.combinedShippingMode === 'AUTO_DISCOUNT') {
      insertData.autoDiscountPercent = validated.data.autoDiscountPercent;
      insertData.autoDiscountMinItems = validated.data.autoDiscountMinItems ?? 2;
    }

    // If setting as default, unset existing default
    if (insertData.isDefault) {
      await db
        .update(shippingProfile)
        .set({ isDefault: false })
        .where(
          and(
            eq(shippingProfile.userId, userId),
            eq(shippingProfile.isDefault, true)
          )
        );
    }

    const [profile] = await db
      .insert(shippingProfile)
      .values(insertData)
      .returning({ id: shippingProfile.id });

    if (!profile) {
      return { success: false, error: 'Failed to create shipping profile' };
    }

    revalidatePath('/my/selling/shipping');
    revalidatePath('/my/selling/listings/new');

    return {
      success: true,
      profileId: profile.id,
    };
  } catch (error) {
    logger.error('Error creating shipping profile', { error: String(error) });
    return { success: false, error: 'Failed to create shipping profile' };
  }
}

/**
 * Update an existing shipping profile
 */
export async function updateShippingProfile(
  data: UpdateShippingProfileInput
): Promise<ActionResult> {
  const { ability, session } = await authorize();

  if (!session) {
    return { success: false, error: 'Not authenticated' };
  }

  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;

  // CASL authorization check - user must be able to manage ShippingProfile
  if (!ability.can('manage', sub('ShippingProfile', { userId }))) {
    return { success: false, error: 'Not authorized to manage shipping profiles' };
  }

  // Validate input
  const validated = updateShippingProfileSchema.safeParse(data);
  if (!validated.success) {
    return { success: false, error: 'Invalid input' };
  }

  try {
    // Verify ownership
    const profile = await getShippingProfileById(data.id, userId);
    if (!profile) {
      return { success: false, error: 'Profile not found' };
    }

    // Build update data
    const updateData: {
      name?: string;
      carrier?: string;
      service?: string | null;
      handlingTimeDays?: number;
      weightOz?: number | null;
      lengthIn?: number | null;
      widthIn?: number | null;
      heightIn?: number | null;
      combinedShippingMode?: 'NONE' | 'FLAT' | 'PER_ADDITIONAL' | 'AUTO_DISCOUNT' | 'QUOTED';
      flatCombinedCents?: number | null;
      additionalItemCents?: number | null;
      autoDiscountPercent?: number | null;
      autoDiscountMinItems?: number | null;
      isDefault?: boolean;
    } = {};
    if (validated.data.name !== undefined) updateData.name = validated.data.name;
    if (validated.data.carrier !== undefined) updateData.carrier = validated.data.carrier;
    if (validated.data.service !== undefined) updateData.service = validated.data.service;
    if (validated.data.handlingTimeDays !== undefined) updateData.handlingTimeDays = validated.data.handlingTimeDays;
    if (validated.data.weightOz !== undefined) updateData.weightOz = validated.data.weightOz;
    if (validated.data.lengthIn !== undefined) updateData.lengthIn = validated.data.lengthIn;
    if (validated.data.widthIn !== undefined) updateData.widthIn = validated.data.widthIn;
    if (validated.data.heightIn !== undefined) updateData.heightIn = validated.data.heightIn;

    // Handle combined shipping mode updates
    if (validated.data.combinedShippingMode !== undefined) {
      updateData.combinedShippingMode = validated.data.combinedShippingMode;

      // Clear all mode-specific fields first
      updateData.flatCombinedCents = null;
      updateData.additionalItemCents = null;
      updateData.autoDiscountPercent = null;
      updateData.autoDiscountMinItems = null;

      // Set relevant fields based on mode
      if (validated.data.combinedShippingMode === 'FLAT' && validated.data.flatCombinedCents !== undefined) {
        updateData.flatCombinedCents = validated.data.flatCombinedCents;
      } else if (validated.data.combinedShippingMode === 'PER_ADDITIONAL' && validated.data.additionalItemCents !== undefined) {
        updateData.additionalItemCents = validated.data.additionalItemCents;
      } else if (validated.data.combinedShippingMode === 'AUTO_DISCOUNT') {
        if (validated.data.autoDiscountPercent !== undefined) {
          updateData.autoDiscountPercent = validated.data.autoDiscountPercent;
        }
        if (validated.data.autoDiscountMinItems !== undefined) {
          updateData.autoDiscountMinItems = validated.data.autoDiscountMinItems;
        }
      }
    }

    // Handle default swap if requested
    if (validated.data.isDefault === true && !profile.isDefault) {
      await db
        .update(shippingProfile)
        .set({ isDefault: false })
        .where(
          and(
            eq(shippingProfile.userId, userId),
            eq(shippingProfile.isDefault, true)
          )
        );
      updateData.isDefault = true;
    }

    await db
      .update(shippingProfile)
      .set(updateData)
      .where(eq(shippingProfile.id, data.id));

    revalidatePath('/my/selling/shipping');
    revalidatePath('/my/selling/listings/new');

    return { success: true, profileId: data.id };
  } catch (error) {
    logger.error('Error updating shipping profile', { error: String(error) });
    return { success: false, error: 'Failed to update shipping profile' };
  }
}

// Re-export delete and setDefault from their dedicated module
export { deleteShippingProfile, setDefaultShippingProfile } from './shipping-profile-manage';
