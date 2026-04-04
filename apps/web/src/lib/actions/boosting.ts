'use server';

/**
 * D2.4: Boosting / Promoted Listings Server Actions
 */

import { revalidatePath } from 'next/cache';
import { db } from '@twicely/db';
import { listing, promotedListing, sellerProfile } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { authorize, sub } from '@twicely/casl';
import { canUseFeature } from '@twicely/utils/tier-gates';
import { validateBoostRate } from '@twicely/commerce/boosting';
import { getPromotedListingByListingId } from '@/lib/queries/boosting';
import { z } from 'zod';

const activateBoostSchema = z.object({
  listingId: z.string().cuid2(),
  boostPercent: z.number().min(1).max(100),
}).strict();

const deactivateBoostSchema = z.object({
  listingId: z.string().cuid2(),
}).strict();

const updateBoostRateSchema = z.object({
  listingId: z.string().cuid2(),
  boostPercent: z.number().min(1).max(100),
}).strict();

interface ActionResult {
  success: boolean;
  error?: string;
}

async function getSellerProfileWithTier(userId: string) {
  const [row] = await db
    .select({ id: sellerProfile.id, storeTier: sellerProfile.storeTier })
    .from(sellerProfile)
    .where(eq(sellerProfile.userId, userId))
    .limit(1);
  return row ?? null;
}

// ─── Activate Boost ──────────────────────────────────────────────────────────

export interface ActivateBoostInput {
  listingId: string;
  boostPercent: number;
}

export async function activateBoost(input: ActivateBoostInput): Promise<ActionResult> {
  const { ability, session } = await authorize();
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }
  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;
  if (!ability.can('update', sub('Listing', { ownerUserId: userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = activateBoostSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const profile = await getSellerProfileWithTier(userId);
  if (!profile) {
    return { success: false, error: 'Seller profile required' };
  }

  if (!canUseFeature(profile.storeTier, 'boosting')) {
    return { success: false, error: 'Boosting requires Pro plan or higher' };
  }

  const validation = await validateBoostRate(input.boostPercent);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Verify seller owns the listing
  const [listingRow] = await db
    .select({ id: listing.id, ownerUserId: listing.ownerUserId, status: listing.status })
    .from(listing)
    .where(eq(listing.id, input.listingId))
    .limit(1);

  if (!listingRow) {
    return { success: false, error: 'Listing not found' };
  }

  if (listingRow.ownerUserId !== userId) {
    return { success: false, error: 'Unauthorized' };
  }

  if (listingRow.status !== 'ACTIVE') {
    return { success: false, error: 'Only active listings can be boosted' };
  }

  // Check if already boosted
  const existingBoost = await getPromotedListingByListingId(input.listingId);
  if (existingBoost) {
    return { success: false, error: 'Listing already boosted' };
  }

  const now = new Date();

  // Insert promoted_listing record
  await db.insert(promotedListing).values({
    listingId: input.listingId,
    sellerId: userId,
    boostPercent: input.boostPercent,
    isActive: true,
    impressions: 0,
    clicks: 0,
    sales: 0,
    totalFeeCents: 0,
    startedAt: now,
  });

  // Update listing with boost info
  await db
    .update(listing)
    .set({
      boostPercent: input.boostPercent,
      boostStartedAt: now,
      updatedAt: now,
    })
    .where(eq(listing.id, input.listingId));

  revalidatePath('/my/selling/promoted');
  return { success: true };
}

// ─── Deactivate Boost ────────────────────────────────────────────────────────

export interface DeactivateBoostInput {
  listingId: string;
}

export async function deactivateBoost(input: DeactivateBoostInput): Promise<ActionResult> {
  const { ability, session } = await authorize();
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }
  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;
  if (!ability.can('update', sub('Listing', { ownerUserId: userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = deactivateBoostSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  // Verify seller owns the listing
  const [listingRow] = await db
    .select({ id: listing.id, ownerUserId: listing.ownerUserId })
    .from(listing)
    .where(eq(listing.id, input.listingId))
    .limit(1);

  if (!listingRow) {
    return { success: false, error: 'Listing not found' };
  }

  if (listingRow.ownerUserId !== userId) {
    return { success: false, error: 'Unauthorized' };
  }

  // Find active boost
  const existingBoost = await getPromotedListingByListingId(input.listingId);
  if (!existingBoost) {
    return { success: false, error: 'No active boost found for this listing' };
  }

  const now = new Date();

  // Update promoted_listing to deactivate
  await db
    .update(promotedListing)
    .set({ isActive: false, endedAt: now, updatedAt: now })
    .where(eq(promotedListing.id, existingBoost.id));

  // Clear boost fields on listing
  await db
    .update(listing)
    .set({ boostPercent: null, boostStartedAt: null, updatedAt: now })
    .where(eq(listing.id, input.listingId));

  revalidatePath('/my/selling/promoted');
  return { success: true };
}

// ─── Update Boost Rate ───────────────────────────────────────────────────────

export interface UpdateBoostRateInput {
  listingId: string;
  boostPercent: number;
}

export async function updateBoostRate(input: UpdateBoostRateInput): Promise<ActionResult> {
  const { ability, session } = await authorize();
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }
  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;
  if (!ability.can('update', sub('Listing', { ownerUserId: userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = updateBoostRateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const profile = await getSellerProfileWithTier(userId);
  if (!profile) {
    return { success: false, error: 'Seller profile required' };
  }

  if (!canUseFeature(profile.storeTier, 'boosting')) {
    return { success: false, error: 'Boosting requires Pro plan or higher' };
  }

  const validation = await validateBoostRate(input.boostPercent);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Verify seller owns the listing
  const [listingRow] = await db
    .select({ id: listing.id, ownerUserId: listing.ownerUserId })
    .from(listing)
    .where(eq(listing.id, input.listingId))
    .limit(1);

  if (!listingRow) {
    return { success: false, error: 'Listing not found' };
  }

  if (listingRow.ownerUserId !== userId) {
    return { success: false, error: 'Unauthorized' };
  }

  // Find active boost
  const existingBoost = await getPromotedListingByListingId(input.listingId);
  if (!existingBoost) {
    return { success: false, error: 'No active boost found for this listing' };
  }

  const now = new Date();

  // Update promoted_listing rate
  await db
    .update(promotedListing)
    .set({ boostPercent: input.boostPercent, updatedAt: now })
    .where(eq(promotedListing.id, existingBoost.id));

  // Update listing boost rate
  await db
    .update(listing)
    .set({ boostPercent: input.boostPercent, updatedAt: now })
    .where(eq(listing.id, input.listingId));

  revalidatePath('/my/selling/promoted');
  return { success: true };
}
