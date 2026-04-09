'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@twicely/db';
import { businessInfo, auditEvent } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { authorize, sub } from '@twicely/casl';
import { ensureSellerProfile } from '@/lib/listings/seller-activate';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { getSellerProfile } from '@/lib/queries/seller';
import { getBusinessInfo } from '@/lib/queries/business-info';
import { businessInfoSchema } from '@/lib/validations/seller-onboarding';

interface ActionResult {
  success: boolean;
  error?: string;
  alreadySeller?: boolean;
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

