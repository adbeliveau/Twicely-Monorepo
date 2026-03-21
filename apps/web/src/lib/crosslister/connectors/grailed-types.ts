/**
 * TypeScript interfaces for Grailed API responses.
 * Source: Grailed API Reference; F3 install prompt — GRAILED (Tier B, OAuth)
 *
 * Auth URL: https://www.grailed.com/oauth/authorize
 * Token URL: https://www.grailed.com/oauth/token
 * API base: https://www.grailed.com/api
 */

/** Grailed listing image */
export interface GrailedImage {
  id: number;
  url: string;
  position: number;
}

/** Grailed designer (brand) */
export interface GrailedDesigner {
  id: number;
  name: string;
  slug: string;
}

/** Grailed category */
export interface GrailedCategory {
  id: number;
  name: string;
  display_name: string;
}

/**
 * Grailed listing from GET /listings/mine
 * Condition is represented as boolean flags.
 * Price is returned as a decimal string.
 */
export interface GrailedListing {
  id: number;
  title: string;
  description: string;
  /** Price as decimal string, e.g. "89.99" */
  price: string;
  /** ISO currency code */
  currency: string;
  /** Condition booleans — only one will be true */
  is_new: boolean;
  is_gently_used: boolean;
  is_used: boolean;
  is_very_worn: boolean;
  /** Listing status */
  sold: boolean;
  bumped: boolean;
  deleted: boolean;
  /** Designer/brand info */
  designer?: GrailedDesigner;
  designers?: GrailedDesigner[];
  /** Category info */
  category?: GrailedCategory;
  /** Images array */
  photos?: GrailedImage[];
  /** Listing URL on Grailed */
  link?: string;
  /** ISO 8601 timestamps */
  created_at?: string;
  updated_at?: string;
  /** Size information */
  size?: string;
  size_drop?: string;
  /** Location */
  location?: string;
}

/** Grailed paginated listings response */
export interface GrailedListingsResponse {
  listings: GrailedListing[];
  page: number;
  per_page: number;
  total_count: number;
}

/** Grailed OAuth token response */
export interface GrailedTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

/** Grailed user profile */
export interface GrailedUserProfile {
  id: number;
  username: string;
  email?: string;
  avatar_url?: string;
}
