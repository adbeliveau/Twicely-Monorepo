/**
 * The RealReal listing normalizer — maps TRR internal API fields to
 * Twicely ExternalListing shape.
 * Source: F3 install prompt — THEREALREAL (Tier C, session-based)
 *
 * NOT a 'use server' file — plain TypeScript module.
 * Key rule: TRR returns price as decimal string "450.00" → parse to 45000 cents.
 * Condition mapping: TRR uses Excellent/Very Good/Good/Fair/Poor → Twicely conditions.
 */

import type { ExternalListing, ExternalImage } from '../types';
import type { TrrConsignment } from '@twicely/crosslister/connectors/therealreal-types';

/** Normalized The RealReal listing data, ready for listing creation */
export interface TrrNormalizedData {
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
 * TRR condition grade → Twicely condition enum mapping.
 * Source: F3 install prompt — THEREALREAL condition values
 */
const TRR_CONDITION_MAP: Record<string, string | null> = {
  Excellent: 'LIKE_NEW',
  'Very Good': 'VERY_GOOD',
  Good: 'GOOD',
  Fair: 'ACCEPTABLE',
  Poor: 'ACCEPTABLE',
};

/**
 * Parse TRR decimal price string to integer cents.
 * e.g. "450.00" → 45000
 */
export function parseTrrPrice(value: string): number {
  const parsed = parseFloat(value);
  if (!isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100);
}

/**
 * Map TRR listing status to Twicely status.
 */
function mapTrrStatus(status: string | undefined): 'ACTIVE' | 'SOLD' | 'ENDED' | 'DRAFT' {
  switch (status) {
    case 'listed':
      return 'ACTIVE';
    case 'sold':
      return 'SOLD';
    case 'returned':
    case 'expired':
      return 'ENDED';
    case 'pending':
    default:
      return 'ENDED';
  }
}

/**
 * Map TRR consignment to normalized data shape.
 */
export function normalizeTrrListing(raw: TrrConsignment): TrrNormalizedData {
  // Title: trim, max 200 chars (TRR max is 80)
  const title = (raw.title ?? '').trim().slice(0, 200);

  // Description: plain text
  const description = (raw.description ?? '').trim();

  // Price: parse decimal string to integer cents
  const priceCents = parseTrrPrice(raw.price ?? '0');
  const currencyCode = raw.currency ?? 'USD';

  // Quantity: always 1 on TRR (luxury single items)
  const quantity = 1;

  // Condition: map TRR grade to Twicely enum
  const rawCondition = raw.condition ?? '';
  const condition = TRR_CONDITION_MAP[rawCondition] ?? null;

  // Brand
  const brand = raw.designer?.name ?? null;

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
  const status = mapTrrStatus(raw.status);

  // URL: construct from ID
  const url = `https://www.therealreal.com/products/${raw.id}`;

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
  if (rawCondition) {
    itemSpecifics['trrCondition'] = rawCondition;
  }
  if (raw.authentication_status) {
    itemSpecifics['authenticationStatus'] = raw.authentication_status;
  }
  if (raw.condition_notes) {
    itemSpecifics['conditionNotes'] = raw.condition_notes;
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
 * Convert TrrNormalizedData to ExternalListing shape for the connector pipeline.
 */
export function toExternalListing(normalized: TrrNormalizedData): ExternalListing {
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
