/**
 * TypeScript interfaces for Vestiaire Collective internal API responses.
 * Source: H4.2 install prompt — VESTIAIRE (Tier C, session-based)
 *
 * Vestiaire Collective is a luxury peer-to-peer marketplace (French, HQ Paris).
 * Key differences from TRR:
 *   - Sellers set their own price (unlike TRR consignment pricing)
 *   - Multi-currency: EUR, GBP, USD, CHF, SEK, DKK, NOK
 *   - No authentication_status field (unlike TRR)
 *   - URL pattern: vestiairecollective.com/products/p-{id}.html
 */

/** Vestiaire product image */
export interface VestiaireImage {
  id: string;
  url: string;
  position: number;
  is_primary?: boolean;
}

/** Vestiaire brand */
export interface VestiaireBrand {
  id: number;
  name: string;
  slug?: string;
}

/** Vestiaire category */
export interface VestiaireCategory {
  id: number;
  name: string;
  path?: string;
}

/** Vestiaire condition labels */
export type VestiaireCondition =
  | 'Never worn'
  | 'Never worn, with tag'
  | 'Very good condition'
  | 'Good condition'
  | 'Fair condition'
  | string;

/** Vestiaire listing from internal API — modeled after observed JSON-LD + internal API shape */
export interface VestiaireListing {
  id: string;
  title: string;
  description?: string;
  /** Price as decimal string, e.g. "450.00" or "1299.50" */
  price: string;
  /** ISO 4217 currency code — EUR, GBP, USD, CHF, etc. */
  currency?: string;
  condition?: VestiaireCondition;
  /** Listing status */
  status?: 'on_sale' | 'sold' | 'reserved' | 'withdrawn' | 'pending_moderation';
  brand?: VestiaireBrand;
  category?: VestiaireCategory;
  images?: VestiaireImage[];
  /** ISO 8601 timestamps */
  created_at?: string;
  sold_at?: string;
  /** Size information (e.g. "EU 38", "M", "One Size") */
  size?: string;
  /** Color */
  color?: string;
  /** Material */
  material?: string;
  /** Seller-facing URL handle/slug */
  slug?: string;
}

/** Vestiaire paginated response */
export interface VestiaireListingsResponse {
  items: VestiaireListing[];
  page: number;
  per_page: number;
  total: number;
  has_more: boolean;
}

/**
 * Session data stored in crosslisterAccount.sessionData.
 * Shape MUST match what captureSession() in vestiaire.ts returns:
 *   { sessionToken, userId, email, detectedAt }
 */
export interface VestiaireSessionData {
  sessionToken: string;
  userId: string;
  email: string;
  /** Timestamp when session was captured by extension */
  detectedAt?: number;
  [key: string]: unknown;
}
