'use server';

/**
 * F6: Update Automation Settings Server Action
 *
 * Upserts the automationSetting row for the authenticated seller.
 * Gate: seller must have hasAutomation === true.
 * Source: F6 install prompt §B.4.
 */

import { revalidatePath } from 'next/cache';
import { db } from '@twicely/db';
import { authorize, sub } from '@twicely/casl';
import { sellerProfile, automationSetting } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { updateAutomationSettingsSchema } from '@/lib/validations/crosslister';
import type { UpdateAutomationSettingsInput } from '@/lib/validations/crosslister';

// ─── Types ───────────────────────────────────────────────────────────────────

interface UpdateAutomationSettingsResult {
  success: boolean;
  error?: string;
}

// ─── Action ──────────────────────────────────────────────────────────────────

export async function updateAutomationSettingsAction(
  input: UpdateAutomationSettingsInput,
): Promise<UpdateAutomationSettingsResult> {
  // 1. authorize() session
  const { ability, session } = await authorize();
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }
  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;

  // 2. CASL check
  if (!ability.can('manage', sub('AutomationSetting', { sellerId: userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  // 3. Validate input against existing schema (strict mode — rejects unknown keys)
  const parsed = updateAutomationSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const data = parsed.data;

  // 4. Gate: seller must have hasAutomation === true
  const [profile] = await db
    .select({ hasAutomation: sellerProfile.hasAutomation })
    .from(sellerProfile)
    .where(eq(sellerProfile.userId, userId))
    .limit(1);

  if (!profile?.hasAutomation) {
    return { success: false, error: 'Automation add-on is required to save these settings.' };
  }

  // 5. Upsert automationSetting row (explicit field mapping — never spread input)
  const [existing] = await db
    .select({ id: automationSetting.id })
    .from(automationSetting)
    .where(eq(automationSetting.sellerId, userId))
    .limit(1);

  const now = new Date();

  if (existing) {
    await db
      .update(automationSetting)
      .set({
        ...(data.autoRelistEnabled !== undefined && { autoRelistEnabled: data.autoRelistEnabled }),
        ...(data.autoRelistDays !== undefined && { autoRelistDays: data.autoRelistDays }),
        ...(data.autoRelistChannels !== undefined && { autoRelistChannels: data.autoRelistChannels }),
        ...(data.offerToLikersEnabled !== undefined && { offerToLikersEnabled: data.offerToLikersEnabled }),
        ...(data.offerDiscountPercent !== undefined && { offerDiscountPercent: data.offerDiscountPercent }),
        ...(data.offerMinDaysListed !== undefined && { offerMinDaysListed: data.offerMinDaysListed }),
        ...(data.priceDropEnabled !== undefined && { priceDropEnabled: data.priceDropEnabled }),
        ...(data.priceDropPercent !== undefined && { priceDropPercent: data.priceDropPercent }),
        ...(data.priceDropIntervalDays !== undefined && { priceDropIntervalDays: data.priceDropIntervalDays }),
        ...(data.priceDropFloorPercent !== undefined && { priceDropFloorPercent: data.priceDropFloorPercent }),
        ...(data.poshShareEnabled !== undefined && { poshShareEnabled: data.poshShareEnabled }),
        ...(data.poshShareTimesPerDay !== undefined && { poshShareTimesPerDay: data.poshShareTimesPerDay }),
        updatedAt: now,
      })
      .where(eq(automationSetting.id, existing.id));
  } else {
    await db.insert(automationSetting).values({
      sellerId: userId,
      autoRelistEnabled: data.autoRelistEnabled ?? false,
      autoRelistDays: data.autoRelistDays ?? 30,
      autoRelistChannels: data.autoRelistChannels ?? [],
      offerToLikersEnabled: data.offerToLikersEnabled ?? false,
      offerDiscountPercent: data.offerDiscountPercent ?? 10,
      offerMinDaysListed: data.offerMinDaysListed ?? 7,
      priceDropEnabled: data.priceDropEnabled ?? false,
      priceDropPercent: data.priceDropPercent ?? 5,
      priceDropIntervalDays: data.priceDropIntervalDays ?? 14,
      priceDropFloorPercent: data.priceDropFloorPercent ?? 50,
      poshShareEnabled: data.poshShareEnabled ?? false,
      poshShareTimesPerDay: data.poshShareTimesPerDay ?? 3,
    });
  }

  // 6. Revalidate
  revalidatePath('/my/selling/crosslist/automation');

  return { success: true };
}
