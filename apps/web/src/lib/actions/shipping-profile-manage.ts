'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@twicely/db';
import { shippingProfile } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import { authorize, sub } from '@twicely/casl';
import {
  setDefaultShippingProfileSchema,
  deleteShippingProfileSchema,
} from '@/lib/validations/shipping-profile';
import { getShippingProfileById, getShippingProfileListingCount } from '@/lib/queries/shipping-profiles';
import { logger } from '@twicely/logger';

interface ActionResult {
  success: boolean;
  profileId?: string;
  error?: string;
}

/**
 * Delete a shipping profile
 */
export async function deleteShippingProfile(
  profileId: string
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
  const validated = deleteShippingProfileSchema.safeParse({ id: profileId });
  if (!validated.success) {
    return { success: false, error: 'Invalid input' };
  }

  try {
    // Verify ownership
    const profile = await getShippingProfileById(profileId, userId);
    if (!profile) {
      return { success: false, error: 'Profile not found' };
    }

    // Cannot delete default profile
    if (profile.isDefault) {
      return {
        success: false,
        error: 'Cannot delete the default profile. Set another profile as default first.',
      };
    }

    // Check if profile is assigned to active listings
    const listingCount = await getShippingProfileListingCount(profileId);
    if (listingCount > 0) {
      return {
        success: false,
        error: `This profile is used by ${listingCount} active listing${listingCount > 1 ? 's' : ''}`,
      };
    }

    await db
      .delete(shippingProfile)
      .where(eq(shippingProfile.id, profileId));

    revalidatePath('/my/selling/shipping');
    revalidatePath('/my/selling/listings/new');

    return { success: true };
  } catch (error) {
    logger.error('Error deleting shipping profile', { error });
    return { success: false, error: 'Failed to delete shipping profile' };
  }
}

/**
 * Set a profile as the default shipping profile
 */
export async function setDefaultShippingProfile(
  profileId: string
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
  const validated = setDefaultShippingProfileSchema.safeParse({ id: profileId });
  if (!validated.success) {
    return { success: false, error: 'Invalid input' };
  }

  try {
    // Verify ownership
    const profile = await getShippingProfileById(profileId, userId);
    if (!profile) {
      return { success: false, error: 'Profile not found' };
    }

    // Unset existing default and set new default atomically
    await db
      .update(shippingProfile)
      .set({ isDefault: false })
      .where(
        and(
          eq(shippingProfile.userId, userId),
          eq(shippingProfile.isDefault, true)
        )
      );

    await db
      .update(shippingProfile)
      .set({ isDefault: true })
      .where(eq(shippingProfile.id, profileId));

    revalidatePath('/my/selling/shipping');
    revalidatePath('/my/selling/listings/new');

    return { success: true, profileId };
  } catch (error) {
    logger.error('Error setting default shipping profile', { error });
    return { success: false, error: 'Failed to set default profile' };
  }
}
