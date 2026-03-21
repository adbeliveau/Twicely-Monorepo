/**
 * Vestiaire Collective listing normalizer — maps Vestiaire internal API fields to
 * Twicely ExternalListing shape.
 * Source: H4.2 install prompt — VESTIAIRE (Tier C, session-based)
 *
 * NOT a 'use server' file — plain TypeScript module.
 * Key rules:
 *   - Vestiaire prices are decimal strings "450.00" → parse to 45000 cents.
 *   - Default currency: EUR (Vestiaire is a French company), NOT USD.
 *   - No currency conversion — currencyCode passed through as-is.
 *   - quantity always 1 (luxury single items).
 */

import type { ExternalListing, ExternalImage } from '../types';
import type { VestiaireListing } from './vestiaire-types';

/** Normalized Vestiaire listing data, ready for listing creation */
export interface VestiaireNormalizedData {
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
  shippingType: null;
  shippingPriceCents: null;
  weight: null;
  dimensions: null;
}

/**
 * Vestiaire condition label → Twicely condition enum mapping.
 * Source: H4.2 install prompt — VESTIAIRE condition values
 */
const VESTIAIRE_CONDITION_MAP: Record<string, string | null> = {
  'Never worn': 'NEW_WITHOUT_TAGS',
  'Never worn, with tag': 'NEW_WITH_TAGS',
  'Very good condition': 'VERY_GOOD',
  'Good condition': 'GOOD',
  'Fair condition': 'ACCEPTABLE',
};

/**
 * Parse Vestiaire decimal price string to integer cents.
 * Handles both period-decimal ("450.00") and comma-decimal ("1.299,50") formats.
 * e.g. "450.00" → 45000, "1299.50" → 129950
 */
export function parseVestiairePrice(value: string): number {
  if (!value) return 0;
  // Handle European comma-decimal format: "1.299,50" → "1299.50"
  let normalized = value.trim();
  if (/\d{1,3}(?:\.\d{3})*,\d{2}/.test(normalized)) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  }
  const parsed = parseFloat(normalized);
  if (!isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100);
}

/**
 * Map Vestiaire listing status to Twicely status.
 */
function mapVestiaireStatus(status: string | undefined): 'ACTIVE' | 'SOLD' | 'ENDED' | 'DRAFT' {
  switch (status) {
    case 'on_sale':
      return 'ACTIVE';
    case 'sold':
      return 'SOLD';
    case 'reserved':
      return 'ACTIVE'; // Reserved is still active on Vestiaire
    case 'withdrawn':
    case 'pending_moderation':
    default:
      return 'ENDED';
  }
}

/**
 * Map Vestiaire listing to normalized data shape.
 */
export function normalizeVestiaireListing(raw: VestiaireListing): VestiaireNormalizedData {
  // Title: trim, max 200 chars (Vestiaire max title is 80, but truncate at 200 for safety)
  const title = (raw.title ?? '').trim().slice(0, 200);

  // Description: plain text
  const description = (raw.description ?? '').trim();

  // Price: parse decimal string to integer cents
  const priceCents = parseVestiairePrice(raw.price ?? '0');
  // Default to EUR (Vestiaire is French, EUR is most common). NOT USD like TRR.
  const currencyCode = raw.currency ?? 'EUR';

  // Quantity: always 1 on Vestiaire (luxury single items)
  const quantity = 1;

  // Condition: map Vestiaire label to Twicely enum
  const rawCondition = raw.condition ?? '';
  const condition = VESTIAIRE_CONDITION_MAP[rawCondition] ?? null;

  // Brand
  const brand = raw.brand?.name ?? null;

  // Images: sorted by position, is_primary first
  const images: ExternalImage[] = (raw.images ?? [])
    .slice()
    .sort((a, b) => {
      if (a.is_primary && !b.is_primary) return -1;
      if (!a.is_primary && b.is_primary) return 1;
      return a.position - b.position;
    })
    .map((img, idx) => ({
      url: img.url,
      isPrimary: idx === 0,
      sortOrder: idx,
    }));

  // Category
  const category = raw.category?.name ?? null;

  // Status
  const status = mapVestiaireStatus(raw.status);

  // URL: construct from ID with p- prefix per Vestiaire URL pattern
  const url = raw.slug
    ? `https://www.vestiairecollective.com/${raw.slug}`
    : `https://www.vestiairecollective.com/products/p-${raw.id}.html`;

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

  // itemSpecifics: size, color, material, vestiaireCondition (original label)
  const itemSpecifics: Record<string, string> = {};
  if (raw.size) {
    itemSpecifics['size'] = raw.size;
  }
  if (raw.color) {
    itemSpecifics['color'] = raw.color;
  }
  if (raw.material) {
    itemSpecifics['material'] = raw.material;
  }
  if (rawCondition) {
    itemSpecifics['vestiaireCondition'] = rawCondition;
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
    shippingType: null,
    shippingPriceCents: null,
    weight: null,
    dimensions: null,
  };
}

/**
 * Convert VestiaireNormalizedData to ExternalListing shape for the connector pipeline.
 */
export function toExternalListing(normalized: VestiaireNormalizedData): ExternalListing {
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
