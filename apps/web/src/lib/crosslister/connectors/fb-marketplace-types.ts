/**
 * TypeScript interfaces for Facebook Commerce API (Graph API) responses.
 * Source: Facebook Commerce API Reference; F3 install prompt — FB_MARKETPLACE (Tier B, OAuth)
 *
 * Auth URL: https://www.facebook.com/v18.0/dialog/oauth
 * Token URL: https://graph.facebook.com/v18.0/oauth/access_token
 * API base: https://graph.facebook.com/v18.0
 */

/** Facebook Commerce listing image */
export interface FbCommerceImage {
  id: string;
  url: string;
}

/** Facebook Commerce listing price — returned as integer cents */
export interface FbCommercePrice {
  amount: number;
  currency: string;
}

/** Facebook Commerce listing condition values */
export type FbCommerceCondition =
  | 'NEW'
  | 'USED_LIKE_NEW'
  | 'USED_GOOD'
  | 'USED_FAIR'
  | string;

/** Facebook Commerce listing — from GET /me/commerce_listings */
export interface FbCommerceListing {
  id: string;
  name: string;
  description?: string;
  price?: FbCommercePrice;
  /** Integer cents in the price field */
  currency?: string;
  condition?: FbCommerceCondition;
  availability?: 'in stock' | 'out of stock' | 'preorder' | 'available for order';
  category?: string;
  brand?: string;
  images?: FbCommerceImage[];
  /** Product URL on Facebook */
  product_item_id?: string;
  /** When the listing was created (ISO string) */
  created_time?: string;
  /** Listing status */
  retailer_id?: string;
}

/** Facebook Commerce paginated listings response */
export interface FbCommerceListingsResponse {
  data: FbCommerceListing[];
  paging?: {
    cursors?: {
      before: string;
      after: string;
    };
    next?: string;
    previous?: string;
  };
}

/** Facebook OAuth token response */
export interface FbOAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  error?: {
    message: string;
    type: string;
    code: number;
  };
}

/** Facebook user profile — from GET /me */
export interface FbUserProfile {
  id: string;
  name: string;
  email?: string;
}
