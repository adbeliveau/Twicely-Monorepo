'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@twicely/db';
import { sellerProfile, businessInfo, auditEvent } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { authorize, sub } from '@twicely/casl';
import { ensureSellerProfile } from '@/lib/listings/seller-activate';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { getSellerProfile } from '@/lib/queries/seller';
import { getBusinessInfo } from '@/lib/queries/business-info';
import { businessInfoSchema, storeNameSchema } from '@/lib/validations/seller-onboarding';

interface ActionResult {
  success: boolean;
  error?: string;
  alreadySeller?: boolean;
}

export interface OnboardingProgress {
  step: 1 | 2 | 3 | 4;
  hasBusinessInfo: boolean;
  hasStripe: boolean;
  hasStoreName: boolean;
  isComplete: boolean;
}

// ─── enableSellerAction ───────────────────────────────────────────────────────

/**
 * Path A: Instantly activate the current user as a PERSONAL seller.
 * Creates sellerProfile + sets user.isSeller = true.
 */
export async function enableSellerAction(): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) {
    return { success: false, error: 'Please sign in to continue' };
  }
  if (!ability.can('create', 'SellerProfile')) {
    return { success: false, error: 'Not authorized' };
  }

  // Idempotent: already a seller
  if (session.isSeller) {
    return { success: true, alreadySeller: true };
  }

  // Check platform gate — seller registration may be disabled
  const sellerRegistrationEnabled = await getPlatformSetting<boolean>(
    'general.sellerRegistrationEnabled',
    true
  );
  if (!sellerRegistrationEnabled) {
    return { success: false, error: 'Seller registration is currently unavailable. Please try again later.' };
  }

  await ensureSellerProfile(session.userId);

  await db.insert(auditEvent).values({
    actorType: 'USER',
    actorId: session.userId,
    action: 'SELLER_ACTIVATED',
    subject: 'SellerProfile',
    subjectId: session.userId,
    severity: 'LOW',
    detailsJson: {},
  });

  revalidatePath('/my');

  return { success: true };
}

// ─── submitBusinessInfoAction ─────────────────────────────────────────────────

/**
 * Path B step 1: Submit business info for the first time.
 * Creates a businessInfo record only. The seller's sellerType is NOT flipped
 * to BUSINESS here — that happens at the end of the wizard in
 * updateStoreNameAction, so the seller is only "a business" once the full
 * onboarding process is complete.
 */
export async function submitBusinessInfoAction(input: unknown): Promise<ActionResult> {
  const { ability, session } = await authorize();
  if (!session) {
    return { success: false, error: 'Please sign in to continue' };
  }
  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;

  if (!ability.can('manage', sub('SellerProfile', { userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = businessInfoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' };
  }

  const existing = await getBusinessInfo(userId);
  if (existing) {
    return { success: false, error: 'Business info already submitted. Use update instead.' };
  }

  const data = parsed.data;

  const profile = await getSellerProfile(userId);
  if (!profile) {
    return { success: false, error: 'Seller profile not found. Please enable selling first.' };
  }

  await db.insert(businessInfo).values({
    userId,
    businessName: data.businessName,
    businessType: data.businessType,
    ein: data.ein ?? null,
    address1: data.address1,
    address2: data.address2 ?? null,
    city: data.city,
    state: data.state,
    zip: data.zip,
    country: data.country,
    phone: data.phone ?? null,
    website: data.website ?? null,
  });

  await db.insert(auditEvent).values({
    actorType: 'USER',
    actorId: session.userId,
    action: 'BUSINESS_INFO_SUBMITTED',
    subject: 'SellerProfile',
    subjectId: userId,
    severity: 'LOW',
    detailsJson: { businessName: data.businessName, businessType: data.businessType },
  });

  revalidatePath('/my/selling/onboarding');

  return { success: true };
}

// ─── updateBusinessInfoAction ─────────────────────────────────────────────────

/**
 * Update existing business info (owner-approved addition).
 */
export async function updateBusinessInfoAction(input: unknown): Promise<ActionResult> {
  const { ability, session } = await authorize();
  if (!session) {
    return { success: false, error: 'Please sign in to continue' };
  }
  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;

  if (!ability.can('manage', sub('SellerProfile', { userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = businessInfoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' };
  }

  const existing = await getBusinessInfo(userId);
  if (!existing) {
    return { success: false, error: 'No business info found. Use submit instead.' };
  }

  const data = parsed.data;

  await db
    .update(businessInfo)
    .set({
      businessName: data.businessName,
      businessType: data.businessType,
      ein: data.ein ?? null,
      address1: data.address1,
      address2: data.address2 ?? null,
      city: data.city,
      state: data.state,
      zip: data.zip,
      country: data.country,
      phone: data.phone ?? null,
      website: data.website ?? null,
      updatedAt: new Date(),
    })
    .where(eq(businessInfo.userId, userId));

  await db.insert(auditEvent).values({
    actorType: 'USER',
    actorId: session.userId,
    action: 'BUSINESS_INFO_UPDATED',
    subject: 'SellerProfile',
    subjectId: userId,
    severity: 'LOW',
    detailsJson: { businessName: data.businessName },
  });

  revalidatePath('/my/selling/onboarding');

  return { success: true };
}

// ─── updateStoreNameAction ────────────────────────────────────────────────────

/**
 * Path B step 3 (final config step): Set storeName + storeSlug on the seller
 * profile. Requires that business info has been submitted. This is the last
 * configuration step of the business wizard, so if the seller is still
 * PERSONAL we upgrade them to BUSINESS here — this is what "complete the
 * business onboarding process completely" means in practice.
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
