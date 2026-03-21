/**
 * Dedupe service — generates fingerprints and finds duplicate matches.
 * Source: F1.2 install prompt §2.6; Lister Canonical Section 6.2
 *
 * NOT a 'use server' file — plain TypeScript module.
 */

import { createHash } from 'crypto';
import { db } from '@twicely/db';
import { dedupeFingerprint } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import type { ExternalListing } from '../types';

/** English stopwords to remove before hashing title */
const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to',
  'for', 'of', 'with', 'is', 'are', 'was', 'were', 'this', 'that',
  'it', 'its', 'from', 'by', 'as', 'up', 'be', 'have', 'had',
]);

/**
 * Price range bucket for deduplication.
 * Buckets: 0-999, 1000-2499, 2500-4999, 5000-9999, 10000+
 */
function getPriceRange(priceCents: number): string {
  if (priceCents < 1000) return '0-999';
  if (priceCents < 2500) return '1000-2499';
  if (priceCents < 5000) return '2500-4999';
  if (priceCents < 10000) return '5000-9999';
  return '10000+';
}

/**
 * Generate a SHA-256 hash of the normalized title.
 * Lowercased, stopwords removed, remaining words sorted alphabetically.
 */
function hashTitle(title: string): string {
  const normalized = title
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((word) => word.length > 0 && !STOPWORDS.has(word))
    .sort()
    .join(' ');

  return createHash('sha256').update(normalized).digest('hex');
}

/**
 * Generate a composite hash from title + priceRange + brand + category.
 */
function hashComposite(titleHash: string, priceRange: string, brand: string, category: string): string {
  const input = `${titleHash}|${priceRange}|${brand}|${category}`;
  return createHash('sha256').update(input).digest('hex');
}

export interface DedupeInput {
  titleHash: string;
  imageHash: null; // pHash deferred to future enhancement
  priceRange: string;
  compositeHash: string;
}

/**
 * Generate a dedupe fingerprint for a listing.
 */
export function generateFingerprint(listing: ExternalListing, _sellerId: string): DedupeInput {
  const titleHash = hashTitle(listing.title);
  const priceRange = getPriceRange(listing.priceCents);
  const brand = listing.brand ?? '';
  const category = listing.category ?? '';
  const compositeHash = hashComposite(titleHash, priceRange, brand, category);

  return {
    titleHash,
    imageHash: null,
    priceRange,
    compositeHash,
  };
}

export interface DedupeMatch {
  matchListingId: string | null;
  confidence: number;
}

/**
 * Find a duplicate match in the dedupeFingerprint table for a seller.
 *
 * Match levels:
 * - Exact compositeHash match → 95% confidence (strong)
 * - Exact titleHash + same priceRange → 85% confidence (weak, flag for review)
 * - Same titleHash only → 75% confidence (weak)
 * - No match → 0%
 */
export async function findDedupeMatch(
  fingerprint: DedupeInput,
  sellerId: string,
): Promise<DedupeMatch> {
  // Check for exact composite hash match (strongest signal)
  const [exactMatch] = await db
    .select({ listingId: dedupeFingerprint.listingId })
    .from(dedupeFingerprint)
    .where(
      and(
        eq(dedupeFingerprint.sellerId, sellerId),
        eq(dedupeFingerprint.compositeHash, fingerprint.compositeHash),
      ),
    )
    .limit(1);

  if (exactMatch) {
    return { matchListingId: exactMatch.listingId, confidence: 95 };
  }

  // Check for title hash match (weaker signal)
  const [titleMatch] = await db
    .select({
      listingId: dedupeFingerprint.listingId,
      priceRange: dedupeFingerprint.priceRange,
    })
    .from(dedupeFingerprint)
    .where(
      and(
        eq(dedupeFingerprint.sellerId, sellerId),
        eq(dedupeFingerprint.titleHash, fingerprint.titleHash),
      ),
    )
    .limit(1);

  if (titleMatch) {
    // If price range also matches → slightly higher confidence
    const confidence = titleMatch.priceRange === fingerprint.priceRange ? 85 : 75;
    return { matchListingId: titleMatch.listingId, confidence };
  }

  return { matchListingId: null, confidence: 0 };
}
