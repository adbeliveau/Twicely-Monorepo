/**
 * TypeScript interfaces for Etsy Open API v3 responses.
 * Source: Etsy Open API v3 Reference
 * Reference: F3 install prompt — Etsy (Tier A, OAuth)
 */

/** Etsy price amount — amount in smallest currency unit (cents when divisor=100) */
export interface EtsyMoney {
  amount: number;
  divisor: number;
  currency_code: string;
}

/** Etsy listing image */
export interface EtsyListingImage {
  listing_image_id: number;
  url_fullxfull: string;
  rank: number;
  is_watermarked: boolean;
}

/** Etsy listing production partner */
export interface EtsyProductionPartner {
  partner_id: number;
  partner_name: string;
  location: string;
}

/** Etsy listing translation */
export interface EtsyListingTranslation {
  listing_id: number;
  language: string;
  title: string;
  description: string;
  tags: string[];
}

/** Etsy listing from GET /application/shops/{shop_id}/listings */
export interface EtsyListing {
  listing_id: number;
  user_id: number;
  shop_id: number;
  title: string;
  description: string;
  state: 'active' | 'inactive' | 'sold_out' | 'draft' | 'expired' | 'removed';
  creation_timestamp: number;
  ending_timestamp: number | null;
  original_creation_timestamp: number;
  last_modified_timestamp: number;
  state_timestamp: number;
  quantity: number;
  shop_section_id: number | null;
  featured_rank: number;
  url: string;
  num_favorers: number;
  non_taxable: boolean;
  is_taxable: boolean;
  is_customizable: boolean;
  is_personalizable: boolean;
  personalization_is_required: boolean;
  personalization_char_count_max: number | null;
  personalization_instructions: string | null;
  listing_type: string;
  tags: string[];
  materials: string[];
  shipping_profile_id: number | null;
  return_policy_id: number | null;
  processing_min: number | null;
  processing_max: number | null;
  who_made: string;
  when_made: string;
  is_supply: boolean;
  item_weight: number | null;
  item_weight_unit: string | null;
  item_length: number | null;
  item_width: number | null;
  item_height: number | null;
  item_dimensions_unit: string | null;
  is_private: boolean;
  taxonomy_id: number | null;
  /** Optional: joined when listing is fetched with images */
  images?: EtsyListingImage[];
  /** Price info — present when fetched with full listing data */
  price?: EtsyMoney;
  /** Taxonomy path (category path) */
  taxonomy_path?: string[];
}

/** Etsy paginated listings response */
export interface EtsyListingsResponse {
  count: number;
  results: EtsyListing[];
  params?: {
    limit: number;
    offset: number;
    shop_id: number;
  };
}

/** Etsy OAuth token response */
export interface EtsyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  error?: string;
  error_description?: string;
}

/** Etsy shop (user account) — from GET /application/users/{user_id}/shops */
export interface EtsyShop {
  shop_id: number;
  shop_name: string;
  user_id: number;
  title: string;
  num_favorers: number;
}

/** Etsy user profile — from GET /application/users/me */
export interface EtsyUserProfile {
  user_id: number;
  login_name: string;
  primary_email: string;
  shop_id?: number;
}
