/**
 * Etsy listing normalizer — maps Etsy Open API v3 fields to Twicely ExternalListing shape.
 * Source: F3 install prompt — Etsy (Tier A, OAuth)
 *
 * NOT a 'use server' file — plain TypeScript module.
 * Key rule: Etsy returns price as { amount: 2500, divisor: 100, currency_code: "USD" }
 * → priceCents = amount (already cents when divisor=100).
 */

import type { ExternalListing, ExternalImage } from '../types';
import type { EtsyListing } from './etsy-types';

/** Normalized Etsy listing data, ready for listing creation */
export interface EtsyNormalizedData {
  externalId: string;
  title: string;
  description: string;
  priceCents: number;
  currencyCode: string;
  quantity: number;
  condition: null;
  brand: null;
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
 * Etsy state -> Twicely status mapping.
 */
function mapEtsyStatus(state: string): 'ACTIVE' | 'SOLD' | 'ENDED' | 'DRAFT' {
  switch (state) {
    case 'active':
      return 'ACTIVE';
    case 'sold_out':
      return 'SOLD';
    case 'draft':
      return 'DRAFT';
    case 'inactive':
    case 'expired':
    case 'removed':
    default:
      return 'ENDED';
  }
}

/**
 * Parse Etsy price amount to integer cents.
 * Etsy returns { amount: 2500, divisor: 100 } → 2500 cents = $25.00
 * When divisor != 100, normalize: amount / divisor * 100
 */
export function parseEtsyPrice(amount: number, divisor: number): number {
  if (!isFinite(amount) || amount < 0) return 0;
  if (divisor === 100) return Math.round(amount);
  if (divisor <= 0) return 0;
  return Math.round((amount / divisor) * 100);
}

/**
 * Map Etsy Open API listing to normalized data shape.
 * Note: Etsy does not have a condition field — set to null per spec.
 */
export function normalizeEtsyListing(raw: EtsyListing): EtsyNormalizedData {
  // Title: trim, max 200 chars (Etsy max is 140 but we store up to 200)
  const title = (raw.title ?? '').trim().slice(0, 200);

  // Description: plain text
  const description = (raw.description ?? '').trim();

  // Price: from price field
  const amount = raw.price?.amount ?? 0;
  const divisor = raw.price?.divisor ?? 100;
  const priceCents = parseEtsyPrice(amount, divisor);
  const currencyCode = raw.price?.currency_code ?? 'USD';

  // Quantity
  const quantity = typeof raw.quantity === 'number' ? Math.max(1, raw.quantity) : 1;

  // Images: sorted by rank, first is primary
  const images: ExternalImage[] = (raw.images ?? [])
    .slice()
    .sort((a, b) => a.rank - b.rank)
    .map((img, idx) => ({
      url: img.url_fullxfull,
      isPrimary: idx === 0,
      sortOrder: idx,
    }));

  // Category: from taxonomy_path
  const category = raw.taxonomy_path?.[raw.taxonomy_path.length - 1] ?? null;

  // Status
  const status = mapEtsyStatus(raw.state ?? '');

  // URL
  const url = raw.url ?? `https://www.etsy.com/listing/${raw.listing_id}`;

  // listedAt: Unix timestamp in seconds
  let listedAt: Date | null = null;
  if (typeof raw.creation_timestamp === 'number' && raw.creation_timestamp > 0) {
    listedAt = new Date(raw.creation_timestamp * 1000);
  }

  // itemSpecifics: materials + tags as additional metadata
  const itemSpecifics: Record<string, string> = {};
  if (raw.materials && raw.materials.length > 0) {
    itemSpecifics['materials'] = raw.materials.join(', ');
  }
  if (raw.tags && raw.tags.length > 0) {
    itemSpecifics['tags'] = raw.tags.join(', ');
  }
  if (raw.who_made) {
    itemSpecifics['whoMade'] = raw.who_made;
  }
  if (raw.when_made) {
    itemSpecifics['whenMade'] = raw.when_made;
  }

  return {
    externalId: String(raw.listing_id),
    title,
    description,
    priceCents,
    currencyCode,
    quantity,
    condition: null,
    brand: null,
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
 * Convert EtsyNormalizedData to ExternalListing shape for the connector pipeline.
 */
export function toExternalListing(normalized: EtsyNormalizedData): ExternalListing {
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
