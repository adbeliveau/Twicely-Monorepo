'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@twicely/db';
import { listing, listingImage } from '@twicely/db/schema';
import { authorize, sub } from '@twicely/casl';
import { generateListingSlug } from '@/lib/listings/slug';
import { ensureSellerProfile } from '@/lib/listings/seller-activate';
import { notifyCategoryAlertMatches } from '@twicely/notifications/category-alert-notifier';
import { notifyFollowedSellerNewListing } from '@twicely/notifications/followed-seller-notifier';
import { recordPriceChange } from '@/lib/services/price-history-service';
import type { ListingFormData } from '@/types/listing-form';
import { listingFormSchema } from '@/lib/validations/listing';
import { logger } from '@twicely/logger';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { enqueueSearchIndexUpsert } from '@twicely/jobs/search-index-sync';
import { z } from 'zod';

const createListingStatusSchema = z.object({
  status: z.enum(['DRAFT', 'ACTIVE']),
}).strict();

interface ActionResult {
  success: boolean;
  listingId?: string;
  slug?: string;
  error?: string;
}

/**
 * Create a new listing.
 */
export async function createListing(
  data: ListingFormData,
  status: 'DRAFT' | 'ACTIVE'
): Promise<ActionResult> {
  const { ability, session } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };
  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;
  if (!ability.can('create', sub('Listing', { ownerUserId: userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = createListingStatusSchema.safeParse({ status });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const parsedData = listingFormSchema.safeParse(data);
  if (!parsedData.success) {
    return { success: false, error: parsedData.error.issues[0]?.message ?? 'Invalid listing data' };
  }

  // Validate price range from platform_settings
  const priceCents = data.priceCents ?? 0;
  if (priceCents > 0) {
    const minPriceCents = await getPlatformSetting<number>('general.minListingPriceCents', 100);
    const maxPriceCents = await getPlatformSetting<number>('general.maxListingPriceCents', 10000000);
    if (priceCents < minPriceCents) return { success: false, error: `Price must be at least $${(minPriceCents / 100).toFixed(2)}` };
    if (priceCents > maxPriceCents) return { success: false, error: `Price cannot exceed $${(maxPriceCents / 100).toFixed(2)}` };
  }

  try {
    // Ensure seller profile exists (first listing triggers this)
    await ensureSellerProfile(userId);

    // Generate slug from title
    const slug = await generateListingSlug(data.title || 'listing');

    // Insert listing
    const [newListing] = await db
      .insert(listing)
      .values({
        ownerUserId: userId,
        status,
        title: data.title || null,
        description: data.description || null,
        categoryId: data.category?.id ?? null,
        condition: data.condition,
        brand: data.brand || null,
        priceCents: data.priceCents || null,
        originalPriceCents: data.originalPriceCents,
        cogsCents: data.cogsCents,
        quantity: data.quantity,
        availableQuantity: data.quantity,
        slug,
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
        activatedAt: status === 'ACTIVE' ? new Date() : null,
      })
      .returning({ id: listing.id, slug: listing.slug });

    if (!newListing) {
      return { success: false, error: 'Failed to create listing' };
    }

    // Insert images
    if (data.images.length > 0) {
      await db.insert(listingImage).values(
        data.images.map((img, index) => ({
          listingId: newListing.id,
          url: img.url,
          position: index,
          isPrimary: index === 0,
        }))
      );
    }

    revalidatePath('/my/selling');
    revalidatePath('/my/selling/listings');

    // Fire-and-forget: record initial price in history
    if (data.priceCents) {
      recordPriceChange({
        listingId: newListing.id,
        newPriceCents: data.priceCents,
        previousCents: null,
        changeReason: 'MANUAL',
        changedByUserId: userId,
      }).catch((err) => {
        logger.error('[price-history] Failed to record initial price for listing', { listingId: newListing.id, error: String(err) });
      });
    }

    // Fire-and-forget: notify category alert matches + followers for ACTIVE listings
    if (status === 'ACTIVE') {
      notifyCategoryAlertMatches(newListing.id).catch((err) => {
        logger.error('[category-alerts] Failed for listing', { listingId: newListing.id, error: String(err) });
      });
      notifyFollowedSellerNewListing(newListing.id).catch((err) => {
        logger.error('[followed-seller-notify] Failed for listing', { listingId: newListing.id, error: String(err) });
      });
      enqueueSearchIndexUpsert({
        id: newListing.id,
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
        slug: newListing.slug ?? undefined,
        condition: data.condition ?? undefined,
        categoryId: typeof data.category === 'string' ? data.category : undefined,
      }).catch((err) => {
        logger.error('[search-index] Failed to enqueue listing index', { listingId: newListing.id, error: String(err) });
      });
    }

    return {
      success: true,
      listingId: newListing.id,
      slug: newListing.slug ?? undefined,
    };
  } catch (error) {
    logger.error('Create listing error', { error: String(error) });
    return { success: false, error: 'Failed to create listing' };
  }
}
