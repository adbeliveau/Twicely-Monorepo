/**
 * TypeScript interfaces for Mercari API responses.
 * Source: F2 install prompt §2.2.1
 *
 * Mercari returns price as integer cents directly — no decimal string parsing needed.
 */

/** Mercari listing item (from API) */
export interface MercariItem {
  id: string;
  name: string;
  description: string;
  /** Integer cents — Mercari returns cents directly */
  price: number;
  /** 'on_sale', 'sold_out', 'trading', 'inactive' */
  status: string;
  /** 1-6 mapping (see normalizer) */
  condition_id: number;
  photos: Array<{ url: string }>;
  brand?: { id: number; name: string };
  categories?: Array<{ id: number; name: string }>;
  shipping?: {
    method_id: number;
    /** 1=seller pays (free for buyer), 2=buyer pays */
    payer_id: number;
    /** Shipping fee in cents */
    fee?: number;
  };
  /** Unix timestamp (seconds) */
  created: number;
  updated: number;
  item_condition?: string;
}

/** Mercari paginated response */
export interface MercariListingsResponse {
  /** 'OK' or error string */
  result: string;
  data: MercariItem[];
  meta?: {
    next_page_token?: string;
    has_next: boolean;
  };
}

/** Mercari OAuth token response */
export interface MercariTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}

/** Mercari user profile (from /users/me) */
export interface MercariUserProfile {
  id: string;
  name: string;
}
