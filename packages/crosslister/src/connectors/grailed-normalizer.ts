/**
 * Grailed listing normalizer — maps Grailed API fields to Twicely ExternalListing shape.
 * Source: F3 install prompt — GRAILED (Tier B, OAuth)
 *
 * NOT a 'use server' file — plain TypeScript module.
 * Key rule: Grailed returns price as decimal string "89.99" → parse to 8999 cents.
 * Condition mapping: is_new, is_gently_used, is_used, is_very_worn booleans.
 */

import type { ExternalListing, ExternalImage } from '../types';
import type { GrailedListing } from './grailed-types';

/** Normalized Grailed listing data, ready for listing creation */
export interface GrailedNormalizedData {
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
 * Parse Grailed decimal price string to integer cents.
 * e.g. "89.99" → 8999
 */
export function parseGrailedPrice(value: string): number {
  const parsed = parseFloat(value);
  if (!isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100);
}

/**
 * Map Grailed condition booleans to Twicely condition enum.
 * Only one boolean should be true; first match wins.
 */
function mapGrailedCondition(raw: GrailedListing): string | null {
  if (raw.is_new) return 'NEW_WITH_TAGS';
  if (raw.is_gently_used) return 'LIKE_NEW';
  if (raw.is_used) return 'GOOD';
  if (raw.is_very_worn) return 'ACCEPTABLE';
  return null;
}

/**
 * Map Grailed listing to Twicely status.
 */
function mapGrailedStatus(raw: GrailedListing): 'ACTIVE' | 'SOLD' | 'ENDED' | 'DRAFT' {
  if (raw.sold) return 'SOLD';
  if (raw.deleted) return 'ENDED';
  return 'ACTIVE';
}

/**
 * Map Grailed API listing to normalized data shape.
 */
export function normalizeGrailedListing(raw: GrailedListing): GrailedNormalizedData {
  // Title: trim, max 200 chars (Grailed max is 80)
  const title = (raw.title ?? '').trim().slice(0, 200);

  // Description: plain text
  const description = (raw.description ?? '').trim();

  // Price: parse decimal string to integer cents
  const priceCents = parseGrailedPrice(raw.price ?? '0');
  const currencyCode = raw.currency ?? 'USD';

  // Quantity: always 1 on Grailed
  const quantity = 1;

  // Condition
  const condition = mapGrailedCondition(raw);

  // Brand: first designer name
  const designers = raw.designers ?? (raw.designer ? [raw.designer] : []);
  const brand = designers[0]?.name ?? null;

  // Images: sorted by position
  const photos = raw.photos ?? [];
  const images: ExternalImage[] = photos
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((p, idx) => ({
      url: p.url,
      isPrimary: idx === 0,
      sortOrder: idx,
    }));

  // Category
  const category = raw.category?.display_name ?? raw.category?.name ?? null;

  // Status
  const status = mapGrailedStatus(raw);

  // URL
  const url = raw.link ?? `https://www.grailed.com/listings/${raw.id}`;

  // listedAt
  let listedAt: Date | null = null;
  if (raw.created_at) {
    const parsed = new Date(raw.created_at);
    if (!isNaN(parsed.getTime())) listedAt = parsed;
  }

  // itemSpecifics
  const itemSpecifics: Record<string, string> = {};
  if (raw.size) {
    itemSpecifics['size'] = raw.size;
  }
  if (raw.size_drop) {
    itemSpecifics['sizeDrop'] = raw.size_drop;
  }
  if (raw.location) {
    itemSpecifics['location'] = raw.location;
  }
  if (designers.length > 1) {
    itemSpecifics['allDesigners'] = designers.map((d) => d.name).join(', ');
  }

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
 * Convert GrailedNormalizedData to ExternalListing shape for the connector pipeline.
 */
export function toExternalListing(normalized: GrailedNormalizedData): ExternalListing {
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
