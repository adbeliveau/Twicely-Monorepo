/**
 * Poshmark listing normalizer — maps Poshmark internal API fields to
 * Twicely ExternalListing shape.
 * Source: F2 install prompt §2.1.2
 *
 * NOT a 'use server' file — plain TypeScript module.
 * Key rule: Poshmark returns price as { val: "25.00" } — parse to integer cents.
 */

import type { ExternalListing, ExternalImage } from '../types';
import type { PoshmarkListing } from './poshmark-types';

/** Normalized Poshmark listing data, ready for listing creation */
export interface PoshmarkNormalizedData {
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
  shippingPriceCents: null;
  weight: null;
  dimensions: null;
}

/** Poshmark condition -> Twicely condition enum mapping */
const POSHMARK_CONDITION_MAP: Record<string, string | null> = {
  NWT: 'NEW_WITH_TAGS',
  NWOT: 'NEW_WITHOUT_TAGS',
  'Like New': 'LIKE_NEW',
  Good: 'GOOD',
  Fair: 'ACCEPTABLE',
};

/** Poshmark status -> Twicely status mapping */
function mapPoshmarkStatus(status: string): 'ACTIVE' | 'SOLD' | 'ENDED' | 'DRAFT' {
  switch (status) {
    case 'available':
      return 'ACTIVE';
    case 'sold':
      return 'SOLD';
    case 'not_for_sale':
    case 'removed':
      return 'ENDED';
    default:
      return 'ENDED';
  }
}

/**
 * Parse Poshmark decimal price string to integer cents.
 * e.g. "89.99" -> 8999
 * Invalid values return 0.
 */
export function parsePoshmarkPrice(value: string): number {
  const parsed = parseFloat(value);
  if (!isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100);
}

/**
 * Map Poshmark internal API listing to normalized data shape.
 */
export function normalizePoshmarkListing(raw: PoshmarkListing): PoshmarkNormalizedData {
  // Title: trim, max 200 chars
  const title = (raw.title ?? '').trim().slice(0, 200);

  // Description: plain text (no HTML in Poshmark)
  const description = (raw.description ?? '').trim();

  // Price: parse decimal string to integer cents
  const priceCents = parsePoshmarkPrice(raw.price_amount?.val ?? '0');
  const currencyCode = raw.price_amount?.currency_code ?? 'USD';

  // Quantity: sum all size quantities, minimum 1
  const sizeQuantities = raw.inventory?.size_quantities ?? [];
  const quantity = Math.max(
    1,
    sizeQuantities.reduce((sum, sq) => sum + (sq.quantity_available ?? 0), 0),
  );

  // Condition: map to Twicely enum
  const rawCondition = raw.condition ?? '';
  const condition = POSHMARK_CONDITION_MAP[rawCondition] ?? null;

  // Brand
  const brand = raw.brand?.display ?? null;

  // Images: covershot as primary if present, else first picture
  const pictures = raw.pictures ?? [];
  let images: ExternalImage[];
  if (raw.covershot?.url) {
    const covershotUrl = raw.covershot.url;
    images = [
      { url: covershotUrl, isPrimary: true, sortOrder: 0 },
      ...pictures
        .filter((p) => p.url !== covershotUrl)
        .map((p, idx) => ({ url: p.url, isPrimary: false, sortOrder: idx + 1 })),
    ];
  } else {
    images = pictures.map((p, idx) => ({
      url: p.url,
      isPrimary: idx === 0,
      sortOrder: idx,
    }));
  }

  // Category
  const category = raw.catalog?.category_obj?.display ?? null;

  // Status
  const status = mapPoshmarkStatus(raw.status ?? '');

  // URL
  const url = `https://poshmark.com/listing/${raw.id}`;

  // listedAt
  let listedAt: Date | null = null;
  if (raw.created_at) {
    const parsed = new Date(raw.created_at);
    if (!isNaN(parsed.getTime())) listedAt = parsed;
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
    itemSpecifics: {},
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
 * Convert PoshmarkNormalizedData to ExternalListing shape for the connector pipeline.
 */
export function toExternalListing(normalized: PoshmarkNormalizedData): ExternalListing {
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
