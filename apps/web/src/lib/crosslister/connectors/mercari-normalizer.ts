/**
 * Mercari listing normalizer — maps Mercari API fields to Twicely ExternalListing shape.
 * Source: F2 install prompt §2.2.2
 *
 * NOT a 'use server' file — plain TypeScript module.
 * Key rule: Mercari returns price as integer cents directly — no decimal parsing.
 */

import type { ExternalListing, ExternalImage } from '../types';
import type { MercariItem } from '@twicely/crosslister/connectors/mercari-types';

/** Normalized Mercari listing data, ready for listing creation */
export interface MercariNormalizedData {
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
  shippingType: string | null;
  shippingPriceCents: number | null;
  weight: null;
  dimensions: null;
}

/**
 * Mercari condition_id -> Twicely condition enum mapping.
 * Source: F2 install prompt §2.2.2
 */
const MERCARI_CONDITION_MAP: Record<number, string | null> = {
  1: 'NEW_WITH_TAGS',
  2: 'LIKE_NEW',
  3: 'GOOD',
  4: 'GOOD',        // Mercari "Fair" maps to Twicely "Good"
  5: 'ACCEPTABLE',  // Mercari "Poor"
  6: 'NEW_WITHOUT_TAGS',
};

/** Mercari status -> Twicely status mapping */
function mapMercariStatus(status: string): 'ACTIVE' | 'SOLD' | 'ENDED' | 'DRAFT' {
  switch (status) {
    case 'on_sale':
      return 'ACTIVE';
    case 'sold_out':
    case 'trading':
      return 'SOLD';
    case 'inactive':
      return 'ENDED';
    default:
      return 'ENDED';
  }
}

/**
 * Map Mercari API item to normalized data shape.
 */
export function normalizeMercariListing(raw: MercariItem): MercariNormalizedData {
  // Title: trim, max 200 chars
  const title = (raw.name ?? '').trim().slice(0, 200);

  // Description: plain text
  const description = (raw.description ?? '').trim();

  // Price: Mercari returns integer cents directly
  const priceCents = typeof raw.price === 'number' ? raw.price : 0;
  const currencyCode = 'USD'; // Mercari US only

  // Quantity: always 1 (Mercari is single-quantity per listing)
  const quantity = 1;

  // Condition from condition_id
  const condition = MERCARI_CONDITION_MAP[raw.condition_id] ?? null;

  // Brand
  const brand = raw.brand?.name ?? null;

  // Images: first photo is primary
  const photos = raw.photos ?? [];
  const images: ExternalImage[] = photos.map((p, idx) => ({
    url: p.url,
    isPrimary: idx === 0,
    sortOrder: idx,
  }));

  // Category: first category name
  const category = raw.categories?.[0]?.name ?? null;

  // Status
  const status = mapMercariStatus(raw.status ?? '');

  // URL
  const url = `https://www.mercari.com/us/item/${raw.id}/`;

  // listedAt: Unix timestamp in seconds
  let listedAt: Date | null = null;
  if (typeof raw.created === 'number' && raw.created > 0) {
    listedAt = new Date(raw.created * 1000);
  }

  // Shipping
  const shippingType = raw.shipping?.payer_id === 1 ? 'FREE' : 'FLAT';
  const shippingPriceCents = raw.shipping?.fee ?? null;

  return {
    externalId: String(raw.id),
    title,
    description,
    priceCents,
    currencyCode,
    quantity,
    condition,
    brand,
    images,
    itemSpecifics: {},
    url,
    status,
    listedAt,
    soldAt: null,
    category,
    shippingType,
    shippingPriceCents,
    weight: null,
    dimensions: null,
  };
}

/**
 * Convert MercariNormalizedData to ExternalListing shape for the connector pipeline.
 */
export function toExternalListing(normalized: MercariNormalizedData): ExternalListing {
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
