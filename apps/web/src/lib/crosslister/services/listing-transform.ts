/**
 * Listing transform service — converts a canonical Twicely listing into a
 * TransformedListing ready for connector.createListing().
 * Source: Lister Canonical Section 15.2 (Transform Engine), Section 7.4 (Overrides)
 *
 * NOT a 'use server' file. Plain TypeScript module.
 */

import { getChannelMetadata } from '../channel-registry';
import type {
  ExternalChannel,
  TransformedListing,
  TransformedImage,
  TransformedShipping,
  ExternalCategoryMapping,
} from '../types';

// ---- Public interfaces ----

export interface CanonicalListingData {
  id: string;
  title: string | null;
  description: string | null;
  priceCents: number | null;
  condition: string | null;
  brand: string | null;
  quantity: number;
  weightOz: number | null;
  lengthIn: number | null;
  widthIn: number | null;
  heightIn: number | null;
  freeShipping: boolean;
  shippingCents: number;
  attributesJson: Record<string, unknown>;
  categoryId: string | null;
}

export interface CanonicalImageData {
  url: string;
  position: number;
  isPrimary: boolean;
}

export interface ChannelOverrides {
  titleOverride?: string | null;
  descriptionOverride?: string | null;
  priceCentsOverride?: number | null;
  categoryOverride?: ExternalCategoryMapping | null;
  shippingOverride?: TransformedShipping | null;
  itemSpecificsOverride?: Record<string, string> | null;
}

export interface TransformInput {
  listing: CanonicalListingData;
  images: CanonicalImageData[];
  channel: ExternalChannel;
  overrides: ChannelOverrides | null;
  /** Pre-fetched category mapping for this listing+channel, or null */
  categoryMapping: ExternalCategoryMapping | null;
  /** Handling time in days (from platformSetting, or default 3) */
  handlingTimeDays?: number;
}

// ---- HTML helpers ----

/** Wrap bare text in a <p> tag for Tier A platforms (eBay, Etsy). */
function toHtmlDescription(text: string): string {
  return `<p>${text.replace(/\n/g, '</p><p>')}</p>`;
}

/** Strip HTML tags to produce plain text. */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

// ---- Transform logic ----

/**
 * Transform a canonical listing + images into a platform-specific TransformedListing.
 * Applies per-channel overrides and respects channel capability limits.
 */
export function transformListingForChannel(input: TransformInput): TransformedListing {
  const { listing, images, channel, overrides, categoryMapping, handlingTimeDays = 3 } = input;
  const metadata = getChannelMetadata(channel);
  const caps = metadata.defaultCapabilities;

  // 1. Title
  const rawTitle = overrides?.titleOverride ?? listing.title ?? '';
  const title = rawTitle.slice(0, caps.maxTitleLength);

  // 2. Description + HTML
  const rawDesc = overrides?.descriptionOverride ?? listing.description ?? '';
  const truncatedDesc = rawDesc.slice(0, caps.maxDescriptionLength);
  const isTierA = channel === 'EBAY' || channel === 'ETSY';
  const description = isTierA ? truncatedDesc : stripHtml(truncatedDesc).slice(0, caps.maxDescriptionLength);
  const descriptionHtml = isTierA ? toHtmlDescription(truncatedDesc) : null;

  // 3. Price (integer cents, must be > 0)
  const rawPrice = overrides?.priceCentsOverride ?? listing.priceCents ?? 0;
  const priceCents = Math.max(1, Math.floor(rawPrice));

  // 4. Images — sort by position, limit to channel max, first is primary
  const sortedImages: CanonicalImageData[] = [...images].sort((a, b) => a.position - b.position);
  const limitedImages = sortedImages.slice(0, caps.maxImagesPerListing);
  const transformedImages: TransformedImage[] = limitedImages.map((img, idx) => ({
    url: img.url,
    sortOrder: img.position,
    isPrimary: idx === 0,
  }));

  // 5. Category
  const category: ExternalCategoryMapping =
    overrides?.categoryOverride ??
    categoryMapping ??
    { externalCategoryId: '', externalCategoryName: '', path: [] };

  // 6. Shipping
  const shipping: TransformedShipping = overrides?.shippingOverride ?? buildShipping(listing, handlingTimeDays);

  // 7. Item specifics
  const itemSpecifics: Record<string, string> =
    overrides?.itemSpecificsOverride ?? attributesToStrings(listing.attributesJson);

  // 8. Condition (pass-through)
  const condition = listing.condition ?? '';

  // 9. Quantity
  const quantity = listing.quantity;

  // 10. Brand
  const brand = listing.brand ?? null;

  return {
    title,
    description,
    descriptionHtml,
    priceCents,
    quantity,
    condition,
    category,
    brand,
    images: transformedImages,
    itemSpecifics,
    shipping,
  };
}

function buildShipping(listing: CanonicalListingData, handlingTimeDays: number): TransformedShipping {
  if (listing.freeShipping) {
    return { type: 'FREE', flatRateCents: null, weightOz: null, dimensions: null, handlingTimeDays };
  }
  if (listing.shippingCents > 0) {
    return { type: 'FLAT', flatRateCents: listing.shippingCents, weightOz: null, dimensions: null, handlingTimeDays };
  }
  const dimensions =
    listing.lengthIn !== null && listing.widthIn !== null && listing.heightIn !== null
      ? { length: listing.lengthIn, width: listing.widthIn, height: listing.heightIn }
      : null;
  return {
    type: 'CALCULATED',
    flatRateCents: null,
    weightOz: listing.weightOz,
    dimensions,
    handlingTimeDays,
  };
}

function attributesToStrings(attrs: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(attrs)) {
    if (typeof val === 'string') {
      result[key] = val;
    } else if (val !== null && val !== undefined) {
      result[key] = String(val);
    }
  }
  return result;
}
