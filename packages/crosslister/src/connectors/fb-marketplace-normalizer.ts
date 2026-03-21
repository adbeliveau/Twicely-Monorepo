/**
 * Facebook Marketplace listing normalizer — maps Facebook Commerce API fields
 * to Twicely ExternalListing shape.
 * Source: F3 install prompt — FB_MARKETPLACE (Tier B, OAuth)
 *
 * NOT a 'use server' file — plain TypeScript module.
 * Key rule: Facebook returns price as integer cents in `price.amount` field.
 * Condition mapping: NEW, USED_LIKE_NEW, USED_GOOD, USED_FAIR → Twicely conditions.
 */

import type { ExternalListing, ExternalImage } from '../types';
import type { FbCommerceListing } from './fb-marketplace-types';

/** Normalized Facebook Marketplace listing data, ready for listing creation */
export interface FbMarketplaceNormalizedData {
  externalId: string;
  title: string;
  description: string;
  priceCents: number;
  currencyCode: string;
  quantity: number;
  condition: string | null;
  brand: string | null;
  images: ExternalImage[];
  itemSpecifics: Record<string, string>;
  url: string;
  status: 'ACTIVE' | 'SOLD' | 'ENDED' | 'DRAFT';
  listedAt: Date | null;
  soldAt: null;
  category: string | null;
  shippingType: null;
  shippingPriceCents: null;
  weight: null;
  dimensions: null;
}

/**
 * Facebook condition → Twicely condition enum mapping.
 * Source: F3 install prompt — FB_MARKETPLACE condition values
 */
const FB_CONDITION_MAP: Record<string, string | null> = {
  NEW: 'NEW_WITHOUT_TAGS',
  USED_LIKE_NEW: 'LIKE_NEW',
  USED_GOOD: 'GOOD',
  USED_FAIR: 'ACCEPTABLE',
};

/**
 * Facebook availability → Twicely status mapping.
 */
function mapFbStatus(availability: string | undefined): 'ACTIVE' | 'SOLD' | 'ENDED' | 'DRAFT' {
  switch (availability) {
    case 'in stock':
    case 'available for order':
    case 'preorder':
      return 'ACTIVE';
    case 'out of stock':
    default:
      return 'ENDED';
  }
}

/**
 * Map Facebook Commerce listing to normalized data shape.
 */
export function normalizeFbMarketplaceListing(raw: FbCommerceListing): FbMarketplaceNormalizedData {
  // Title: trim, max 200 chars (FB max is 80)
  const title = (raw.name ?? '').trim().slice(0, 200);

  // Description: plain text
  const description = (raw.description ?? '').trim();

  // Price: integer cents in price.amount field
  const priceCents = typeof raw.price?.amount === 'number' ? raw.price.amount : 0;
  const currencyCode = raw.price?.currency ?? raw.currency ?? 'USD';

  // Quantity: Facebook Marketplace is single-quantity per listing
  const quantity = 1;

  // Condition: map to Twicely enum
  const rawCondition = raw.condition ?? '';
  const condition = FB_CONDITION_MAP[rawCondition] ?? null;

  // Brand
  const brand = raw.brand ?? null;

  // Images
  const images: ExternalImage[] = (raw.images ?? []).map((img, idx) => ({
    url: img.url,
    isPrimary: idx === 0,
    sortOrder: idx,
  }));

  // Category
  const category = raw.category ?? null;

  // Status
  const status = mapFbStatus(raw.availability);

  // URL: Facebook Marketplace listings don't have a direct public URL via API
  const url = raw.product_item_id
    ? `https://www.facebook.com/marketplace/item/${raw.product_item_id}`
    : `https://www.facebook.com/marketplace/item/${raw.id}`;

  // listedAt
  let listedAt: Date | null = null;
  if (raw.created_time) {
    const parsed = new Date(raw.created_time);
    if (!isNaN(parsed.getTime())) listedAt = parsed;
  }

  // itemSpecifics: store raw condition for seller reference
  const itemSpecifics: Record<string, string> = {};
  if (rawCondition) {
    itemSpecifics['fbCondition'] = rawCondition;
  }
  if (raw.retailer_id) {
    itemSpecifics['retailerId'] = raw.retailer_id;
  }

  return {
    externalId: raw.id,
    title,
    description,
    priceCents,
    currencyCode,
    quantity,
    condition,
    brand,
    images,
    itemSpecifics,
    url,
    status,
    listedAt,
    soldAt: null,
    category,
    shippingType: null,
    shippingPriceCents: null,
    weight: null,
    dimensions: null,
  };
}

/**
 * Convert FbMarketplaceNormalizedData to ExternalListing shape for the connector pipeline.
 */
export function toExternalListing(normalized: FbMarketplaceNormalizedData): ExternalListing {
  return {
    externalId: normalized.externalId,
    title: normalized.title,
    description: normalized.description,
    priceCents: normalized.priceCents,
    currencyCode: normalized.currencyCode,
    quantity: normalized.quantity,
    condition: normalized.condition,
    category: normalized.category,
    brand: normalized.brand,
    images: normalized.images,
    itemSpecifics: normalized.itemSpecifics,
    shippingType: normalized.shippingType,
    shippingPriceCents: normalized.shippingPriceCents,
    weight: normalized.weight,
    dimensions: normalized.dimensions,
    url: normalized.url,
    status: normalized.status,
    listedAt: normalized.listedAt,
    soldAt: normalized.soldAt,
  };
}
