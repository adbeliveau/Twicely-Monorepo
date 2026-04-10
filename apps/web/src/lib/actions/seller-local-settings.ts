'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@twicely/db';
import { sellerProfile } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { authorize, sub } from '@twicely/casl';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { updateSellerLocalSettingsSchema } from '@/lib/validations/local';
import { z } from 'zod';

interface ActionResult {
  success: boolean;
  error?: string;
}

/**
 * Update the seller's local pickup settings (maxMeetupDistanceMiles).
 * Enforces platform max radius from commerce.local.maxRadiusMiles setting.
 */
export async function updateSellerLocalSettings(
  data: z.infer<typeof updateSellerLocalSettingsSchema>
): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;

  if (!ability.can('update', sub('SellerProfile', { userId }))) {
    return { success: false, error: 'Not authorized' };
  }

  const parsed = updateSellerLocalSettingsSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  // Enforce platform max radius dynamically (Zod max of 50 is a safety ceiling)
  if (parsed.data.maxMeetupDistanceMiles !== null) {
    const platformMax = await getPlatformSetting<number>('commerce.local.maxRadiusMiles', 50);
    if (parsed.data.maxMeetupDistanceMiles > platformMax) {
      return {
        success: false,
        error: `Maximum meetup distance is ${platformMax} miles`,
      };
    }
  }

  await db
    .update(sellerProfile)
    .set({
      maxMeetupDistanceMiles: parsed.data.maxMeetupDistanceMiles,
      updatedAt: new Date(),
    })
    .where(eq(sellerProfile.userId, userId));

  revalidatePath('/my/selling/local/settings');

  return { success: true };
}
