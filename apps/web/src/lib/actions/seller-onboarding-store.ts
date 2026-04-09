'use server';

/**
 * Seller onboarding — store name & progress actions.
 * Split from seller-onboarding.ts to stay under 300 lines.
 */

import { revalidatePath } from 'next/cache';
import { db } from '@twicely/db';
import { sellerProfile, auditEvent } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { authorize, sub } from '@twicely/casl';
import { getSellerProfile } from '@/lib/queries/seller';
import { getBusinessInfo } from '@/lib/queries/business-info';
import { storeNameSchema } from '@/lib/validations/seller-onboarding';

interface ActionResult {
  success: boolean;
  error?: string;
}

export interface OnboardingProgress {
  step: 1 | 2 | 3 | 4;
  hasBusinessInfo: boolean;
  hasStripe: boolean;
  hasStoreName: boolean;
  isComplete: boolean;
}

// ─── updateStoreNameAction ────────────────────────────────────────────────────

/**
 * Path B step 3 (final config step): Set storeName + storeSlug on the seller
 * profile. Requires that business info has been submitted. This is the last
 * configuration step of the business wizard, so if the seller is still
 * PERSONAL we upgrade them to BUSINESS here.
 */
export async function updateStoreNameAction(input: unknown): Promise<ActionResult> {
  const { ability, session } = await authorize();
  if (!session) {
    return { success: false, error: 'Please sign in to continue' };
  }
  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;

  if (!ability.can('manage', sub('SellerProfile', { userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = storeNameSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' };
  }

  const [profile, bizInfo] = await Promise.all([
    getSellerProfile(userId),
    getBusinessInfo(userId),
  ]);
  if (!profile) {
    return { success: false, error: 'Seller profile not found' };
  }
  if (!bizInfo) {
    return { success: false, error: 'Business info required before setting a store name' };
  }

  const { storeName, storeSlug } = parsed.data;

  // Check slug uniqueness (skip if it's already theirs)
  if (profile.storeSlug !== storeSlug) {
    const [conflict] = await db
      .select({ id: sellerProfile.id })
      .from(sellerProfile)
      .where(eq(sellerProfile.storeSlug, storeSlug))
      .limit(1);

    if (conflict) {
      return { success: false, error: 'This store URL is already taken' };
    }
  }

  const shouldUpgrade = profile.sellerType !== 'BUSINESS';

  await db
    .update(sellerProfile)
    .set({
      storeName,
      storeSlug,
      ...(shouldUpgrade ? { sellerType: 'BUSINESS' as const } : {}),
      updatedAt: new Date(),
    })
    .where(eq(sellerProfile.userId, userId));

  await db.insert(auditEvent).values({
    actorType: 'USER',
    actorId: session.userId,
    action: 'STORE_NAME_SET',
    subject: 'SellerProfile',
    subjectId: userId,
    severity: 'LOW',
    detailsJson: { storeName, storeSlug },
  });

  if (shouldUpgrade) {
    await db.insert(auditEvent).values({
      actorType: 'USER',
      actorId: session.userId,
      action: 'BUSINESS_UPGRADED',
      subject: 'SellerProfile',
      subjectId: userId,
      severity: 'MEDIUM',
      detailsJson: {
        businessName: bizInfo.businessName,
        businessType: bizInfo.businessType,
      },
    });
  }

  revalidatePath('/my/selling/onboarding');

  return { success: true };
}

// ─── getOnboardingProgressAction ─────────────────────────────────────────────

/**
 * Determine the current onboarding step for Path B (business wizard).
 */
export async function getOnboardingProgressAction(): Promise<
  { success: true; progress: OnboardingProgress } | { success: false; error: string }
> {
  const { session, ability } = await authorize();
  if (!session) {
    return { success: false, error: 'Please sign in to continue' };
  }
  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;
  if (!ability.can('read', sub('SellerProfile', { userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const [profile, bizInfo] = await Promise.all([
    getSellerProfile(userId),
    getBusinessInfo(userId),
  ]);

  const hasBusinessInfo = !!bizInfo;
  const hasStripe = !!(profile?.stripeOnboarded);
  const hasStoreName = !!(profile?.storeName && profile?.storeSlug);
  const isComplete = hasBusinessInfo && hasStripe && hasStoreName;

  let step: 1 | 2 | 3 | 4;
  if (!hasBusinessInfo) {
    step = 1;
  } else if (!hasStripe) {
    step = 2;
  } else if (!hasStoreName) {
    step = 3;
  } else {
    step = 4;
  }

  return {
    success: true,
    progress: { step, hasBusinessInfo, hasStripe, hasStoreName, isComplete },
  };
}
