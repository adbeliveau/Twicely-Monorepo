/**
 * Depop listing normalizer — maps Depop API v2 fields to Twicely ExternalListing shape.
 * Source: F3 install prompt — DEPOP (Tier B, OAuth)
 *
 * NOT a 'use server' file — plain TypeScript module.
 * Key rule: Depop returns price as { price_amount: "25.00", currency_name: "USD" }
 * → parse "25.00" to 2500 cents.
 * Condition mapping: brand_new, like_new, good, fair → Twicely conditions.
 */

import type { ExternalListing, ExternalImage } from '../types';
import type { DepopProduct } from '@twicely/crosslister/connectors/depop-types';

/** Normalized Depop listing data, ready for listing creation */
export interface DepopNormalizedData {
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
  soldAt: Date | null;
  category: string | null;
  shippingType: string | null;
  shippingPriceCents: number | null;
  weight: null;
  dimensions: null;
}

/**
 * Depop condition → Twicely condition enum mapping.
 * Source: F3 install prompt — DEPOP condition values
 */
const DEPOP_CONDITION_MAP: Record<string, string | null> = {
  brand_new: 'NEW_WITHOUT_TAGS',
  like_new: 'LIKE_NEW',
  good: 'GOOD',
  fair: 'ACCEPTABLE',
};

/**
 * Parse Depop decimal price string to integer cents.
 * e.g. "25.00" → 2500
 */
export function parseDepopPrice(value: string): number {
  const parsed = parseFloat(value);
  if (!isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100);
}

/**
 * Map Depop product status to Twicely status.
 */
function mapDepopStatus(status: string | undefined): 'ACTIVE' | 'SOLD' | 'ENDED' | 'DRAFT' {
  switch (status) {
    case 'active':
      return 'ACTIVE';
    case 'sold':
      return 'SOLD';
    case 'draft':
      return 'DRAFT';
    case 'deleted':
    default:
      return 'ENDED';
  }
}

/**
 * Map Depop product to normalized data shape.
 * Max 4 images enforced at capability level — normalizer passes all available.
 */
export function normalizeDepopListing(raw: DepopProduct): DepopNormalizedData {
  // Title: Depop uses slug as title (no dedicated title field)
  // Fall back to slug with hyphens replaced, then id
  const rawTitle = raw.slug
    ? raw.slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : `Depop Listing ${raw.id}`;
  const title = rawTitle.trim().slice(0, 200);

  // Description: plain text
  const description = (raw.description ?? '').trim();

  // Price: parse decimal string to integer cents
  const priceStr = raw.price?.price_amount ?? '0';
  const priceCents = parseDepopPrice(priceStr);
  const currencyCode = raw.price?.currency_name ?? 'USD';

  // Quantity: always 1 on Depop
  const quantity = 1;

  // Condition: map string to Twicely enum
  const rawCondition = raw.condition ?? '';
  const condition = DEPOP_CONDITION_MAP[rawCondition] ?? null;

  // Brand
  const brand = raw.brand?.name ?? null;

  // Images: use pictures or preview_pictures, max 4
  const pictures = (raw.pictures ?? raw.preview_pictures ?? []).slice(0, 4);
  const images: ExternalImage[] = pictures.map((img, idx) => ({
    url: img.url,
    isPrimary: idx === 0,
    sortOrder: idx,
  }));

  // Category
  const category = raw.category?.name ?? null;

  // Status
  const status = mapDepopStatus(raw.status);

  // URL
  const url = raw.url ?? `https://www.depop.com/products/${raw.id}/`;

  // listedAt
  let listedAt: Date | null = null;
  if (raw.created_at) {
    const parsed = new Date(raw.created_at);
    if (!isNaN(parsed.getTime())) listedAt = parsed;
  }

  // soldAt
  let soldAt: Date | null = null;
  if (raw.sold_at) {
    const parsed = new Date(raw.sold_at);
    if (!isNaN(parsed.getTime())) soldAt = parsed;
  }

  // itemSpecifics
  const itemSpecifics: Record<string, string> = {};
  if (raw.size) {
    itemSpecifics['size'] = raw.size;
  }
  if (raw.color1) {
    itemSpecifics['color1'] = raw.color1;
  }
  if (raw.color2) {
    itemSpecifics['color2'] = raw.color2;
  }
  if (rawCondition) {
    itemSpecifics['depopCondition'] = rawCondition;
  }

  // Shipping
  let shippingType: string | null = null;
  let shippingPriceCents: number | null = null;
  if (raw.national_shipping_cost !== undefined) {
    const shippingCost = parseDepopPrice(raw.national_shipping_cost);
    shippingType = shippingCost === 0 ? 'FREE' : 'FLAT';
    shippingPriceCents = shippingCost > 0 ? shippingCost : null;
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
    soldAt,
    category,
    shippingType,
    shippingPriceCents,
    weight: null,
    dimensions: null,
  };
}

/**
 * Convert DepopNormalizedData to ExternalListing shape for the connector pipeline.
 */
export function toExternalListing(normalized: DepopNormalizedData): ExternalListing {
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
