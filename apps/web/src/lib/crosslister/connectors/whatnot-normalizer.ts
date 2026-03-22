/**
 * Whatnot listing normalizer — maps Whatnot API fields to Twicely ExternalListing shape.
 * Source: H2.1 install prompt §2.4
 *
 * NOT a 'use server' file — plain TypeScript module.
 * Key rules:
 * - Price is Money type { amount: "12.99", currencyCode: "USD" } — parse to integer cents.
 * - Images are media[] with type field — filter for images only.
 * - Status: PUBLISHED -> ACTIVE, UNPUBLISHED -> ENDED, SOLD -> SOLD.
 */

import type { ExternalListing, ExternalImage } from '../types';
import type { WhatnotListing } from '@twicely/crosslister/connectors/whatnot-types';

/** Normalized Whatnot listing data, ready for listing creation */
export interface WhatnotNormalizedData {
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
  category: null;
  shippingType: null;
  shippingPriceCents: null;
  weight: null;
  dimensions: null;
}

/**
 * Parse Whatnot Money type to integer cents.
 * "12.99" USD -> 1299
 */
export function parseMoneyToCents(amount: string): number {
  const parsed = parseFloat(amount);
  if (isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
}

/** Whatnot status -> Twicely status mapping */
function mapWhatnotStatus(status: string): 'ACTIVE' | 'SOLD' | 'ENDED' | 'DRAFT' {
  switch (status) {
    case 'PUBLISHED':
      return 'ACTIVE';
    case 'SOLD':
      return 'SOLD';
    case 'UNPUBLISHED':
      return 'ENDED';
    default:
      return 'ENDED';
  }
}

/**
 * Map Whatnot API listing to normalized data shape.
 */
export function normalizeWhatnotListing(raw: WhatnotListing): WhatnotNormalizedData {
  // Title: trim, max 200 chars
  const title = (raw.title ?? '').trim().slice(0, 200);

  // Description: plain text, may be null
  const description = (raw.description ?? '').trim();

  // Price: parse Money type to integer cents
  const priceCents = parseMoneyToCents(raw.price?.amount ?? '0');
  const currencyCode = raw.price?.currencyCode ?? 'USD';

  // Quantity: single quantity model for BIN listings
  const quantity = 1;

  // Images: filter media to images only (type check for image types)
  const mediaItems = raw.media ?? [];
  const imageItems = mediaItems.filter(
    (m) => m.type === 'IMAGE' || m.type === 'image' || m.type.toLowerCase().includes('image'),
  );
  const images: ExternalImage[] = imageItems.map((m, idx) => ({
    url: m.url,
    isPrimary: idx === 0,
    sortOrder: idx,
  }));

  // Status
  const status = mapWhatnotStatus(raw.status ?? '');

  // URL — Whatnot BIN listing URL pattern
  const url = `https://www.whatnot.com/listings/${raw.id}`;

  // listedAt: ISO timestamp
  let listedAt: Date | null = null;
  if (raw.createdAt) {
    const parsed = new Date(raw.createdAt);
    if (!isNaN(parsed.getTime())) listedAt = parsed;
  }

  return {
    externalId: String(raw.id),
    title,
    description,
    priceCents,
    currencyCode,
    quantity,
    condition: null,
    brand: null,
    images,
    itemSpecifics: {},
    url,
    status,
    listedAt,
    soldAt: null,
    category: null,
    shippingType: null,
    shippingPriceCents: null,
    weight: null,
    dimensions: null,
  };
}

/**
 * Convert WhatnotNormalizedData to ExternalListing shape for the connector pipeline.
 */
export function toExternalListing(normalized: WhatnotNormalizedData): ExternalListing {
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
