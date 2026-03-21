/**
 * TypeScript interfaces for Depop API v2 responses.
 * Source: Depop API Reference; F3 install prompt — DEPOP (Tier B, OAuth)
 *
 * Auth URL: https://www.depop.com/oauth/authorize
 * Token URL: https://www.depop.com/oauth/token
 * API base: https://api.depop.com/api/v2
 */

/** Depop product price — returned as decimal string */
export interface DepopPrice {
  price_amount: string;
  currency_name: string;
}

/** Depop product image */
export interface DepopImage {
  id: number;
  url: string;
  width?: number;
  height?: number;
}

/** Depop product category */
export interface DepopCategory {
  id: number;
  name: string;
}

/** Depop product brand */
export interface DepopBrand {
  id: number;
  name: string;
}

/**
 * Depop condition values.
 * brand_new, like_new, good, fair
 */
export type DepopCondition = 'brand_new' | 'like_new' | 'good' | 'fair' | string;

/**
 * Depop product listing — from GET /products
 * Price returned as { price_amount: "25.00", currency_name: "USD" }
 */
export interface DepopProduct {
  id: string;
  slug?: string;
  description?: string;
  price: DepopPrice;
  status?: 'active' | 'sold' | 'deleted' | 'draft';
  condition?: DepopCondition;
  category?: DepopCategory;
  brand?: DepopBrand;
  pictures?: DepopImage[];
  preview_pictures?: DepopImage[];
  /** Product URL on Depop */
  url?: string;
  /** ISO 8601 timestamps */
  created_at?: string;
  updated_at?: string;
  sold_at?: string;
  /** Size information */
  size?: string;
  /** Colors */
  color1?: string;
  color2?: string;
  /** National shipping price */
  national_shipping_cost?: string;
}

/** Depop paginated products response */
export interface DepopProductsResponse {
  objects: DepopProduct[];
  meta?: {
    next?: string | null;
    previous?: string | null;
    end?: boolean;
  };
}

/** Depop OAuth token response */
export interface DepopTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

/** Depop user profile — from GET /auth/users/me */
export interface DepopUserProfile {
  id: string;
  username: string;
  email?: string;
  name?: string;
}
