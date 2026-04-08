'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@twicely/db';
import { listing, listingImage } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { authorize, sub } from '@twicely/casl';
import type { ListingFormData } from '@/types/listing-form';
import { listingFormSchema } from '@/lib/validations/listing';
import { notifyPriceDropWatchers } from '@twicely/notifications/price-drop-notifier';
import { processPriceAlerts } from '@/lib/services/price-alert-processor';
import { recordPriceChange } from '@/lib/services/price-history-service';
import { logger } from '@twicely/logger';
import { z } from 'zod';
import { detectOutboundSyncNeeded, queueOutboundSync } from '@twicely/crosslister/services/outbound-sync';
import { upsertListingDocument, deleteListingDocument } from '@twicely/search/typesense-index';

const updateListingIdSchema = z.object({
  listingId: z.string().cuid2(),
  status: z.enum(['DRAFT', 'ACTIVE']),
}).strict();

/** User-settable statuses (SOLD excluded — only set by checkout system) */
type UserListingStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ENDED';
/** All possible statuses including system-only */
type ListingStatus = UserListingStatus | 'SOLD';

interface ActionResult {
  success: boolean;
  listingId?: string;
  slug?: string;
  error?: string;
}

/**
 * Valid status transitions for listings.
 */
const VALID_TRANSITIONS: Record<ListingStatus, ListingStatus[]> = {
  DRAFT: ['ACTIVE', 'ENDED'],
  ACTIVE: ['PAUSED', 'ENDED', 'SOLD'],
  PAUSED: ['ACTIVE', 'ENDED'],
  ENDED: ['ACTIVE'], // Relist
  SOLD: [], // Terminal state
};

function canTransition(from: ListingStatus, to: ListingStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Update an existing listing.
 */
export async function updateListing(
  listingId: string,
  data: ListingFormData,
  status: 'DRAFT' | 'ACTIVE'
): Promise<ActionResult> {
  const { ability, session } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };
  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;
  if (!ability.can('update', sub('Listing', { ownerUserId: userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = updateListingIdSchema.safeParse({ listingId, status });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const parsedData = listingFormSchema.safeParse(data);
  if (!parsedData.success) {
    return { success: false, error: parsedData.error.issues[0]?.message ?? 'Invalid listing data' };
  }

  try {
    // Verify ownership
    const [existingListing] = await db
      .select({ id: listing.id, ownerUserId: listing.ownerUserId, status: listing.status, priceCents: listing.priceCents })
      .from(listing)
      .where(eq(listing.id, listingId))
      .limit(1);

    if (!existingListing) {
      return { success: false, error: 'Listing not found' };
    }

    if (existingListing.ownerUserId !== userId) {
      return { success: false, error: 'Unauthorized' };
    }

    // Check status transition if changing status
    const currentStatus = existingListing.status as ListingStatus;
    if (currentStatus !== status && !canTransition(currentStatus, status)) {
      return { success: false, error: `Cannot change status from ${currentStatus} to ${status}` };
    }

    const oldPriceCents = existingListing.priceCents;

    // Update listing
    const [updated] = await db
      .update(listing)
      .set({
        title: data.title || null,
        description: data.description || null,
        categoryId: data.category?.id ?? null,
        condition: data.condition,
        brand: data.brand || null,
        priceCents: data.priceCents || null,
        originalPriceCents: data.originalPriceCents,
        cogsCents: data.cogsCents,
        quantity: data.quantity,
        allowOffers: data.allowOffers,
        autoAcceptOfferCents: data.autoAcceptOfferCents,
        autoDeclineOfferCents: data.autoDeclineOfferCents,
        freeShipping: data.freeShipping,
        shippingCents: data.freeShipping ? 0 : data.shippingCents,
        weightOz: data.weightOz,
        lengthIn: data.lengthIn,
        widthIn: data.widthIn,
        heightIn: data.heightIn,
        tags: data.tags,
        fulfillmentType: data.fulfillmentType ?? 'SHIP_ONLY',
        localPickupRadiusMiles: (data.fulfillmentType === 'LOCAL_ONLY' || data.fulfillmentType === 'SHIP_AND_LOCAL')
          ? (data.localPickupRadiusMiles ?? 25)
          : null,
        localHandlingFlags: (data.fulfillmentType === 'LOCAL_ONLY' || data.fulfillmentType === 'SHIP_AND_LOCAL')
          ? (data.localHandlingFlags ?? [])
          : [],
        videoUrl: data.videoUrl,
        videoThumbUrl: data.videoThumbUrl,
        videoDurationSeconds: data.videoDurationSeconds,
        status,
        activatedAt: status === 'ACTIVE' && currentStatus !== 'ACTIVE' ? new Date() : undefined,
        updatedAt: new Date(),
      })
      .where(eq(listing.id, listingId))
      .returning({ id: listing.id, slug: listing.slug });

    // Replace images: delete existing and insert new
    await db.delete(listingImage).where(eq(listingImage.listingId, listingId));

    if (data.images.length > 0) {
      await db.insert(listingImage).values(
        data.images.map((img, index) => ({
          listingId,
          url: img.url,
          position: index,
          isPrimary: index === 0,
        }))
      );
    }

    revalidatePath('/my/selling');
    revalidatePath('/my/selling/listings');
    revalidatePath(`/i/${updated?.slug}`);

    // Record price change in history if price changed
    if (data.priceCents && oldPriceCents && data.priceCents !== oldPriceCents) {
      recordPriceChange({
        listingId,
        newPriceCents: data.priceCents,
        previousCents: oldPriceCents,
        changeReason: 'MANUAL',
        changedByUserId: userId,
      }).catch((err) => {
        logger.error('[price-history] Failed to record price change for listing', { listingId, error: String(err) });
      });
    }

    // Fire-and-forget: notify watchers and process price alerts if price dropped
    if (data.priceCents && oldPriceCents && data.priceCents < oldPriceCents) {
      notifyPriceDropWatchers(listingId, oldPriceCents, data.priceCents).catch((err) => {
        logger.error('[price-drop-watchers] Failed for listing', { listingId, error: String(err) });
      });
      processPriceAlerts(listingId, data.priceCents, oldPriceCents).catch((err) => {
        logger.error('[price-alerts] Failed for listing', { listingId, error: String(err) });
      });
    }

    // Fire-and-forget: sync to Typesense search index
    if (updated && status === 'ACTIVE') {
      upsertListingDocument({
        id: listingId,
        title: data.title ?? '',
        description: data.description ?? undefined,
        brand: data.brand ?? undefined,
        priceCents: data.priceCents ?? 0,
        freeShipping: data.freeShipping ?? false,
        ownerUserId: userId,
        sellerScore: 0,
        sellerTotalReviews: 0,
        activatedAt: Math.floor(Date.now() / 1000),
        createdAt: Math.floor(Date.now() / 1000),
        slug: updated.slug ?? undefined,
        condition: data.condition ?? undefined,
      }).catch((err) => {
        logger.error('[typesense] Failed to update listing in index', { listingId, error: String(err) });
      });
    } else if (status !== 'ACTIVE') {
      deleteListingDocument(listingId).catch((err) => {
        logger.error('[typesense] Failed to remove listing from index', { listingId, error: String(err) });
      });
    }

    // Fire-and-forget: trigger outbound sync to external channels with active projections
    detectOutboundSyncNeeded(listingId).then((targets) => {
      if (targets.length > 0) {
        return queueOutboundSync(listingId, targets);
      }
      return undefined;
    }).catch((err) => {
      logger.error('[outbound-sync] Failed to queue outbound sync for listing', { listingId, error: String(err) });
    });

    return {
      success: true,
      listingId,
      slug: updated?.slug ?? undefined,
    };
  } catch (error) {
    logger.error('Update listing error', { error: String(error) });
    return { success: false, error: 'Failed to update listing' };
  }
}

// ─── Re-exports from listings-update-status.ts (split) ────────────────────
export { updateListingStatus, getListingForEdit } from './listings-update-status';
